begin;

-- Allow admin RLS when public.users row is missing but Auth user_metadata.role is 'admin' (until sync runs).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
  or lower(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', ''))) = 'admin';
$$;

commit;
