begin;

create table if not exists public.teacher_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, class_id)
);

create index if not exists idx_teacher_classes_teacher_id on public.teacher_classes (teacher_id);
create index if not exists idx_teacher_classes_class_id on public.teacher_classes (class_id);

commit;
