-- supabase/migrations/0010_payment_events.sql
-- Phase 2 auto-reconciliation: payment_events ledger + shared mark-paid core.

create type public.payment_event_status as enum
  ('unmatched','ambiguous','applied','ignored');

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'push',          -- adapter: push|email|plaid
  method public.payment_method not null,
  amount numeric(10,2) not null,
  sender text,
  note text,
  raw_text text not null,
  external_id text,
  dedup_key text not null unique,                -- idempotency hash
  received_at timestamptz not null,
  status public.payment_event_status not null default 'unmatched',
  matched_order_id uuid references public.orders(id),
  candidate_orders text[],
  created_at timestamptz not null default now()
);
create index on public.payment_events (status, created_at desc);

alter table public.payment_events enable row level security;
create policy "staff all payment_events" on public.payment_events
  for all using (public.is_staff()) with check (public.is_staff());

grant all on public.payment_events to service_role;
grant select, insert, update, delete on public.payment_events to authenticated;
-- NOTE: no grant to anon — the public never touches this table.

-- Shared core: idempotently mark an order paid + record the payment + link event.
create or replace function public.mark_order_paid(p_order_id uuid, p_event_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_method public.payment_method;
  v_amount numeric(10,2);
  v_status public.payment_status;
begin
  select order_number, payment_method, total, payment_status
    into v_number, v_method, v_amount, v_status
    from public.orders where id = p_order_id;
  if v_number is null then raise exception 'unknown order: %', p_order_id; end if;

  if v_status = 'paid' then
    -- already paid: idempotent no-op; still link the event if one was passed.
    if p_event_id is not null then
      update public.payment_events
        set status = 'applied', matched_order_id = p_order_id where id = p_event_id;
    end if;
    return v_number;
  end if;

  update public.orders
    set payment_status = 'paid', status = 'paid', updated_at = now()
    where id = p_order_id;

  insert into public.payments (order_id, method, amount, status, reference)
    values (p_order_id, v_method, v_amount, 'confirmed', v_number);

  -- FUTURE: decrement inventory here (apply_inventory_movement) once the admin
  -- fulfillment feature owns it. Intentionally omitted in Phase 2 (see spec).

  if p_event_id is not null then
    update public.payment_events
      set status = 'applied', matched_order_id = p_order_id where id = p_event_id;
  end if;

  return v_number;
end;
$$;

grant execute on function public.mark_order_paid(uuid, uuid) to service_role;

-- Ingestion core: dedup → record → match (code, else amount+method+window) → maybe apply.
create or replace function public.ingest_payment_event(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method public.payment_method;
  v_amount numeric(10,2);
  v_dedup text;
  v_event_id uuid;
  v_existing uuid;
  v_code text;
  v_match uuid;
  v_count int;
  v_number text;
  v_candidates text[];
begin
  v_method := (p_payload->>'method')::public.payment_method;
  v_amount := (p_payload->>'amount')::numeric(10,2);
  v_dedup  := p_payload->>'dedup_key';

  insert into public.payment_events
    (channel, method, amount, sender, note, raw_text, external_id, received_at, dedup_key, status)
  values (
    coalesce(p_payload->>'channel','push'), v_method, v_amount,
    p_payload->>'sender', p_payload->>'note', p_payload->>'raw_text',
    p_payload->>'external_id', (p_payload->>'received_at')::timestamptz,
    v_dedup, 'unmatched'
  )
  on conflict (dedup_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_existing from public.payment_events where dedup_key = v_dedup;
    return jsonb_build_object('status','duplicate','order_number',null,'event_id',v_existing);
  end if;

  -- Code path: a KL code anywhere in raw_text that resolves to a matching unpaid order.
  v_code := substring(upper(coalesce(p_payload->>'raw_text','')) from 'KL-[0-9]{8}-[A-Z0-9]{4}');
  if v_code is not null then
    select id, order_number into v_match, v_number
      from public.orders
      where order_number = v_code
        and payment_status = 'unpaid'
        and payment_method = v_method
        and total = v_amount;
    if v_match is not null then
      perform public.mark_order_paid(v_match, v_event_id);
      return jsonb_build_object('status','applied','order_number',v_number,'event_id',v_event_id);
    end if;
  end if;

  -- Amount + method + recent-window path.
  select count(*), min(id::text)::uuid, array_agg(order_number)
    into v_count, v_match, v_candidates
    from public.orders
    where payment_status = 'unpaid'
      and payment_method = v_method
      and total = v_amount
      and created_at >= now() - interval '30 days';

  if v_count = 1 then
    select order_number into v_number from public.orders where id = v_match;
    perform public.mark_order_paid(v_match, v_event_id);
    return jsonb_build_object('status','applied','order_number',v_number,'event_id',v_event_id);
  elsif v_count >= 2 then
    update public.payment_events
      set status = 'ambiguous', candidate_orders = v_candidates where id = v_event_id;
    return jsonb_build_object('status','ambiguous','order_number',null,'event_id',v_event_id);
  else
    return jsonb_build_object('status','unmatched','order_number',null,'event_id',v_event_id);
  end if;
end;
$$;

grant execute on function public.ingest_payment_event(jsonb) to service_role;

-- Staff one-tap: apply a reviewed event to a chosen order.
create or replace function public.apply_payment_event(p_event_id uuid, p_order_number text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  select id into v_order_id from public.orders where order_number = p_order_number;
  if v_order_id is null then raise exception 'unknown order: %', p_order_number; end if;
  return public.mark_order_paid(v_order_id, p_event_id);
end;
$$;

grant execute on function public.apply_payment_event(uuid, text) to service_role;
