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
