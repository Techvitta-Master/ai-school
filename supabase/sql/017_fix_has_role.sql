-- 017_fix_has_role.sql
-- Root cause: has_role() only checked public.user_roles.
--             But handle_new_user_profile() only writes to public.profiles.role.
--             So every real registered user had role in profiles but NULL in user_roles
--             → is_admin() / is_teacher() / is_school() always returned false
--             → all RLS write policies blocked (401/403).
--
-- Fix 1: Update has_role() to check BOTH user_roles AND profiles.
-- Fix 2: Add trigger to sync profiles.role → user_roles on insert/update.
-- Fix 3: Back-fill existing profiles rows into user_roles.

begin;

-- ─────────────────────────────────────────────────────────────
-- 0.  Add unique constraint to user_roles(user_id) if missing
--     (required for ON CONFLICT upserts and trigger logic)
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype = 'u'
      and conkey @> (select array_agg(attnum) from pg_attribute
                     where attrelid = 'public.user_roles'::regclass
                       and attname = 'user_id')
  ) then
    -- Remove duplicate user_id rows (keep the newest) before adding constraint
    delete from public.user_roles ur1
    where ctid <> (
      select min(ur2.ctid)
      from public.user_roles ur2
      where ur2.user_id = ur1.user_id
    );
    alter table public.user_roles add constraint user_roles_user_id_unique unique (user_id);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 1.  Update has_role() to check both tables
-- ─────────────────────────────────────────────────────────────
create or replace function public.has_role(role_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Check legacy user_roles table
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text = role_text
    )
    -- Also check profiles.role (populated by auth trigger for new sign-ups)
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role::text = role_text
    );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2.  Trigger: sync profiles.role → user_roles automatically
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_profile_role_to_user_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not null then
    insert into public.user_roles (user_id, role)
    values (new.user_id, new.role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_role on public.profiles;
create trigger trg_sync_profile_role
after insert or update of role on public.profiles
for each row execute function public.sync_profile_role_to_user_roles();

-- ─────────────────────────────────────────────────────────────
-- 3.  Back-fill: copy existing profiles.role → user_roles
-- ─────────────────────────────────────────────────────────────
insert into public.user_roles (user_id, role)
select p.user_id, p.role
from public.profiles p
where p.role is not null
on conflict (user_id) do update set role = excluded.role;

-- Confirm
select
  p.email,
  p.role   as profile_role,
  ur.role  as user_roles_role,
  case when p.role::text = ur.role::text then '✓ synced' else '✗ mismatch' end as status
from public.profiles p
left join public.user_roles ur on ur.user_id = p.user_id
where p.role is not null
order by p.email;

commit;
