-- 022_school_classes_no_sections.sql
-- Add classes + teacher_class_assignments; students.class_id; drop sections model.
-- If public.sections is missing, only creates empty tables + column (portal adds classes later).

begin;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_name text not null,
  unique (school_id, class_name)
);

create table if not exists public.teacher_class_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject text not null,
  unique (teacher_id, class_id, subject)
);

alter table public.students add column if not exists class_id uuid references public.classes(id) on delete set null;

do $body$
declare
  has_sec_school_id boolean;
  has_sec_class_name boolean;
begin
  if to_regclass('public.sections') is null then
    return;
  end if;

  select exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'sections' and c.column_name = 'school_id'
  ) into has_sec_school_id;

  select exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'sections' and c.column_name = 'class_name'
  ) into has_sec_class_name;

  if has_sec_school_id and has_sec_class_name then
    execute $q$
      insert into public.classes (school_id, class_name)
      select distinct sec.school_id, trim(sec.class_name::text)
      from public.sections sec
      on conflict (school_id, class_name) do nothing
    $q$;
  elsif has_sec_class_name
    and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'students' and c.column_name = 'section_id')
    and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'students' and c.column_name = 'school_id') then
    execute $q$
      insert into public.classes (school_id, class_name)
      select distinct st.school_id, trim(sec.class_name::text)
      from public.sections sec
      inner join public.students st on st.section_id = sec.id and st.school_id is not null
      on conflict (school_id, class_name) do nothing
    $q$;
  end if;
end $body$;

-- s must only appear in WHERE, not inside JOIN ON (Postgres rule for UPDATE ... FROM).
do $body$
begin
  if to_regclass('public.sections') is null then
    return;
  end if;
  if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'sections' and c.column_name = 'class_name') then
    return;
  end if;
  if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'students' and c.column_name = 'section_id') then
    return;
  end if;
  if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'students' and c.column_name = 'school_id') then
    return;
  end if;
  execute $q$
    update public.students s
    set class_id = c.id
    from public.sections sec, public.classes c
    where s.section_id is not null
      and s.section_id = sec.id
      and c.school_id = s.school_id
      and c.class_name = trim(sec.class_name::text)
  $q$;
end $body$;

do $body$
begin
  if to_regclass('public.teacher_section_assignments') is null or to_regclass('public.sections') is null then
    return;
  end if;
  if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'sections' and c.column_name = 'class_name') then
    return;
  end if;
  if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'teachers' and c.column_name = 'school_id') then
    return;
  end if;
  execute $q$
    insert into public.teacher_class_assignments (teacher_id, class_id, subject)
    select tsa.teacher_id, c.id, tsa.subject
    from public.teacher_section_assignments tsa
    join public.sections sec on sec.id = tsa.section_id
    join public.teachers t on t.id = tsa.teacher_id
    join public.classes c
      on c.school_id = t.school_id
     and c.class_name = trim(sec.class_name::text)
    on conflict (teacher_id, class_id, subject) do nothing
  $q$;
end $body$;

drop table if exists public.teacher_section_assignments cascade;
drop table if exists public.sections cascade;

alter table public.students drop column if exists section_id;

alter table public.classes disable row level security;
alter table public.teacher_class_assignments disable row level security;

notify pgrst, 'reload schema';

commit;
