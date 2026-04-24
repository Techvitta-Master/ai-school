begin;

drop policy if exists "storage_answer_sheets_insert_teacher" on storage.objects;
create policy "storage_answer_sheets_insert_teacher"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'answer-sheets'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'teacher'
  )
);

drop policy if exists "storage_answer_sheets_update_owner" on storage.objects;
create policy "storage_answer_sheets_update_owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'answer-sheets'
  and owner = auth.uid()
)
with check (
  bucket_id = 'answer-sheets'
  and owner = auth.uid()
);

drop policy if exists "storage_answer_sheets_delete_owner" on storage.objects;
create policy "storage_answer_sheets_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'answer-sheets'
  and owner = auth.uid()
);

commit;
