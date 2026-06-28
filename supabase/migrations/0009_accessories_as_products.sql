-- supabase/migrations/0009_accessories_as_products.sql
-- Accessories move from the hardcoded ACCESSORIES list into the catalog so the
-- cart prices them server-authoritatively. Hidden from the main grid via the flag.
alter table public.products add column is_accessory boolean not null default false;

insert into public.products (code, name, sub, category, mechanism, is_accessory) values
  ('BAC-WATER', 'Bacteriostatic Water', '30 mL · for reconstitution', 'Supplies', 'Consumable', true),
  ('SYRINGES',  'Insulin Syringes',     '0.5 mL · 31G · box of 10',   'Supplies', 'Consumable', true),
  ('SWABS',     'Alcohol Prep Pads',    'Sterile · box of 100',       'Supplies', 'Consumable', true),
  ('VIALS',     'Sterile Empty Vials',  '10 mL · pack of 5',          'Supplies', 'Consumable', true);

insert into public.product_sizes (product_id, mg, price, sku)
select p.id, x.mg, x.price, x.sku
from public.products p
join (values
  ('BAC-WATER', '30 mL',      11.99, 'BAC-WATER'),
  ('SYRINGES',  'box of 10',   9.99, 'SYRINGES'),
  ('SWABS',     'box of 100',  5.99, 'SWABS'),
  ('VIALS',     'pack of 5',  12.99, 'VIALS')
) as x(code, mg, price, sku) on p.code = x.code;
