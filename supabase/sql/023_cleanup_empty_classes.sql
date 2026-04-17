-- 023_cleanup_empty_classes.sql
-- Remove class rows that have no students and no teacher_class_assignments (e.g. leftover seeds).

begin;

delete from public.classes c
where not exists (select 1 from public.students s where s.class_id = c.id)
  and not exists (select 1 from public.teacher_class_assignments t where t.class_id = c.id);

commit;
