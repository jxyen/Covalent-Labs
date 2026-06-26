create type public.staff_role as enum ('owner', 'staff');

create table public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.staff_role not null default 'staff',
  active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- security-definer helpers bypass RLS, so policies referencing them do not recurse
create or replace function public.is_staff() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active);
$$;

create or replace function public.is_owner() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active and role = 'owner');
$$;

-- a staff member can read their own row; owners can read/manage all
create policy "staff read self" on public.staff
  for select using (id = auth.uid() or public.is_owner());
create policy "owner manage staff" on public.staff
  for all using (public.is_owner()) with check (public.is_owner());

-- auto-create a staff profile row on new auth user (inactive, role=staff)
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Explicit grants required: auto_expose_new_tables is disabled in this project
grant all on public.staff to service_role;
grant select, insert, update, delete on public.staff to authenticated;
grant select on public.staff to anon;
