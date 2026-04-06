-- 004_storage_setup.sql
-- Purpose: Create storage bucket for uploaded test files.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'test-analyses',
  'test-analyses',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

