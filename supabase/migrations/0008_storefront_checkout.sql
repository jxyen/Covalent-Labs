-- supabase/migrations/0008_storefront_checkout.sql
-- Storefront checkout: payment destinations + anon order-placement RPCs.

create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  method public.payment_method not null,
  handle text not null,
  display_name text not null default 'Kairo Labs',
  instructions text,
  qr_path text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payment_accounts (active, sort_order);

alter table public.payment_accounts enable row level security;

create policy "public read active payment_accounts" on public.payment_accounts
  for select using (active = true);
create policy "owner all payment_accounts" on public.payment_accounts
  for all using (public.is_owner()) with check (public.is_owner());

grant all on public.payment_accounts to service_role;
grant select, insert, update, delete on public.payment_accounts to authenticated;
grant select on public.payment_accounts to anon;

-- QR images bucket (mirrors the product-images bucket from 0006).
insert into storage.buckets (id, name, public) values ('payment-qr', 'payment-qr', true)
  on conflict (id) do nothing;
create policy "public read payment-qr" on storage.objects
  for select using (bucket_id = 'payment-qr');
create policy "owner write payment-qr" on storage.objects
  for insert to authenticated with check (bucket_id = 'payment-qr' and public.is_owner());
create policy "owner update payment-qr" on storage.objects
  for update to authenticated using (bucket_id = 'payment-qr' and public.is_owner());
create policy "owner delete payment-qr" on storage.objects
  for delete to authenticated using (bucket_id = 'payment-qr' and public.is_owner());

-- Placeholder accounts — owner replaces handles + uploads QR via /admin/payment-accounts.
insert into public.payment_accounts (method, handle, display_name, sort_order) values
  ('zelle',  'PLACEHOLDER-set-in-admin', 'Kairo Labs', 1),
  ('cashapp','PLACEHOLDER-set-in-admin', 'Kairo Labs', 2),
  ('venmo',  'PLACEHOLDER-set-in-admin', 'Kairo Labs', 3);

-- place_order: the ONLY anon write into orders. Recomputes all money server-side.
create or replace function public.place_order(
  p_items jsonb,
  p_customer jsonb,
  p_payment_method public.payment_method
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_size_id uuid;
  v_qty int;
  v_price numeric(10,2);
  v_mg text;
  v_name text;
  v_active boolean;
  v_line numeric(10,2);
  v_frac numeric;
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_merch numeric(10,2);
  v_shipping numeric(10,2);
  v_total numeric(10,2);
  v_order_id uuid;
  v_number text;
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_tries int := 0;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty';
  end if;

  -- Pass 1: validate + accumulate totals.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_size_id := (v_item->>'size_id')::uuid;
    v_qty := least(greatest(coalesce((v_item->>'quantity')::int, 1), 1), 99);
    select ps.price, ps.mg, p.name, p.active
      into v_price, v_mg, v_name, v_active
      from public.product_sizes ps join public.products p on p.id = ps.product_id
      where ps.id = v_size_id;
    if v_price is null then raise exception 'unknown product size: %', v_size_id; end if;
    if not v_active then raise exception 'product is no longer available: %', v_name; end if;
    v_line := round(v_price * v_qty, 2);
    v_frac := case when v_qty >= 5 then 0.20 when v_qty >= 3 then 0.15 when v_qty >= 2 then 0.10 else 0 end;
    v_subtotal := v_subtotal + v_line;
    v_discount := v_discount + round(v_line * v_frac, 2);
  end loop;

  v_merch := v_subtotal - v_discount;
  v_shipping := case when v_merch > 0 and v_merch < 150 then 9.99 else 0 end;
  v_total := v_merch + v_shipping;

  -- Unique order number.
  loop
    v_tries := v_tries + 1;
    v_number := 'KL-' || to_char(now(), 'YYYYMMDD') || '-' || (
      select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '')
      from generate_series(1, 4)
    );
    exit when not exists (select 1 from public.orders where order_number = v_number);
    if v_tries > 25 then raise exception 'could not allocate order number'; end if;
  end loop;

  insert into public.orders (
    order_number, customer_name, customer_email, customer_phone, shipping_address,
    status, payment_method, payment_status, subtotal, shipping_cost, discount_total, total
  ) values (
    v_number, p_customer->>'name', p_customer->>'email', p_customer->>'phone', p_customer->'address',
    'pending', p_payment_method, 'unpaid', v_subtotal, v_shipping, v_discount, v_total
  ) returning id into v_order_id;

  -- Pass 2: insert line items.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_size_id := (v_item->>'size_id')::uuid;
    v_qty := least(greatest(coalesce((v_item->>'quantity')::int, 1), 1), 99);
    select ps.price, ps.mg, p.name into v_price, v_mg, v_name
      from public.product_sizes ps join public.products p on p.id = ps.product_id
      where ps.id = v_size_id;
    insert into public.order_items (order_id, size_id, product_name, mg, unit_price, quantity, line_total)
    values (v_order_id, v_size_id, v_name, v_mg, v_price, v_qty, round(v_price * v_qty, 2));
  end loop;

  return jsonb_build_object('order_number', v_number, 'total', v_total);
end;
$$;

grant execute on function public.place_order(jsonb, jsonb, public.payment_method) to anon, authenticated, service_role;

-- get_order_for_payment: revisitable pay page; exposes ONLY non-sensitive fields.
create or replace function public.get_order_for_payment(p_order_number text)
returns table (
  order_number text, total numeric, payment_method public.payment_method,
  status public.order_status, payment_status public.payment_status, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select o.order_number, o.total, o.payment_method, o.status, o.payment_status, o.created_at
  from public.orders o
  where o.order_number = p_order_number;
$$;

grant execute on function public.get_order_for_payment(text) to anon, authenticated, service_role;
