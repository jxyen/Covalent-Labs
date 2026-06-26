-- 0006_products_public_and_storage.sql
-- Make the catalog publicly readable, add bundle compare-at price,
-- and create the product image storage bucket.

-- 1. compare-at price for bundle savings
alter table public.products add column compare_at numeric(10,2);

-- 2. public read of ACTIVE products (staff keep full read via is_staff() policy)
create policy "public read active products" on public.products
  for select to anon, authenticated
  using (active = true);

create policy "public read sizes" on public.product_sizes
  for select to anon, authenticated
  using (true);

grant select on public.products to anon;
grant select on public.product_sizes to anon;

-- 3. product image storage bucket
insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

create policy "public read product images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "staff upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());

create policy "staff update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
