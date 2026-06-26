# Staff — terminal brief

**Route:** `src/app/admin/staff/page.tsx` (replace the stub)
**Tables you own:** `staff` (+ Supabase Auth admin API)
**Access:** `requireOwner`

## Goal

Build the owner-only staff management UI so the owner can invite new staff
members, assign roles, and activate or deactivate accounts. Creating a staff
member is a two-step operation: (1) create an Auth user via the Supabase Auth
admin API (using `@/lib/supabase/admin` — service role, never in a request
path), then (2) insert a corresponding row in the `staff` table with the desired
`role` (`staff` or `owner`) and `active` flag.

### Creating the first owner

The first owner is bootstrapped via a throwaway local script (intentionally
gitignored — not committed to the repo). Run it once after `npm run db:reset`:

```
# example one-off bootstrap (do NOT commit this file)
# 1. Use the Supabase dashboard Auth tab or supabase CLI:
#    supabase auth admin create-user --email owner@example.com --password <pw>
# 2. Note the returned user UUID.
# 3. The on_auth_user_created trigger has already inserted a staff row
#    (inactive, role 'staff'). Promote it — do NOT INSERT (the row exists):
#    UPDATE staff SET role = 'owner', active = true, full_name = 'Owner'
#    WHERE id = '<uuid>';
```

Alternatively use the Supabase Studio UI (Table Editor → `staff`) to edit the
auto-created row. Note: the column is `full_name`, not `name`.
Do not reference or create a committed script for this step.

## Definition of done

- [ ] List all staff members with role, active status, and last sign-in
- [ ] Invite a new staff member: call Supabase Auth admin API to create user, then insert `staff` row
- [ ] Set role (`staff` / `owner`) for an existing staff member
- [ ] Activate / deactivate a staff member (`active` flag on `staff` row)
- [ ] Owner cannot deactivate themselves (guard against lockout)
- [ ] RLS respected; Auth admin API calls use `@/lib/supabase/admin` in a trusted server action only
- [ ] Tests under `tests/` cover the data-access functions
- [ ] Types regenerated if schema changed
