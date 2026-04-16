# Supabase SQL Manual Apply Guide

This folder contains ordered SQL migrations for a production-split schema.

## Run Order

Run these files in Supabase SQL Editor exactly in this order:

1. `001_extensions.sql`
2. `002_profiles_and_roles.sql`
3. `003_core_academics_schema.sql`
4. `004_storage_setup.sql`
5. `005_rls_policies.sql`
6. `006_edge_function_support.sql`
7. `007_seed_minimal.sql` (optional minimal sample — skip if using `011_demo_seed.sql`)
8. `008_optional_profile_fields.sql` (extra columns for UI parity)
9. `009_rls_curriculum_reads.sql` (teachers/tests readable across staff for curriculum UIs)
10. `010_syllabus_seed.sql` (full syllabus from `data-ch.json`; regenerate with `node scripts/generate-syllabus-seed.mjs` after editing the JSON)
11. `011_demo_seed.sql` (optional demo sections, teachers, students, tests, scores — matches default demo emails in the app)
12. `012_profiles_registration_columns.sql`
13. `013_profile_on_auth_user.sql`
14. `014a_app_role_school_enum.sql` (adds `school` value to `app_role` enum — run before `014`)
15. `014_schools_role.sql` (schools table, school_id FK, school-role RLS)
16. `015_answer_sheets.sql` (per-student answer sheet uploads + `feedback`/`grade` on scores)

**Recommended for the normalized app:** run `001`–`006`, then `008`–`011`, `012`–`015`. Omit `007` if you rely on `011` for sample rows.

### answer-sheets bucket

After running `015_answer_sheets.sql`, create the storage bucket manually in the Supabase Dashboard:
- **Name:** `answer-sheets`
- **Public:** No (private, access via signed URLs or RLS policies)

## What You Must Do Before Testing App Login

1. Create users in **Supabase Auth** (`admin`, `teacher`, `student` as needed).
2. Insert profile + role rows into:
   - `public.profiles`
   - `public.user_roles`
3. For teacher/student app identity mapping, set:
   - `teachers.user_id = auth.users.id`
   - `students.user_id = auth.users.id`

You can use this starter template:

```sql
insert into public.profiles (user_id, full_name)
values ('<auth_user_uuid>', '<name>')
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role)
values ('<auth_user_uuid>', 'teacher') -- or admin/student
on conflict (user_id, role) do nothing;
```

## Storage Notes

- Bucket name used by app code: `test-analyses`.
- This is created in `004_storage_setup.sql`.
- Storage RLS policies are in `005_rls_policies.sql`.

## Edge Function Notes

The app upload flow can call an Edge Function (default name: `analyze_test`).
Use helper SQL in `006_edge_function_support.sql`, especially:

- `public.register_test_analysis(...)`
- `public.v_test_analysis_context`

## Validation Queries

### 1) Check schema objects

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

### 2) Check policy coverage

```sql
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

### 3) Check role mapping

```sql
select ur.user_id, ur.role, p.full_name
from public.user_roles ur
left join public.profiles p on p.user_id = ur.user_id
order by ur.user_id, ur.role;
```

### 4) Check seed joins

```sql
select s.name as student_name, t.title as test_title, sc.score
from public.scores sc
join public.students s on s.id = sc.student_id
join public.tests t on t.id = sc.test_id;
```

### 5) Check storage bucket

```sql
select id, name, public, file_size_limit
from storage.buckets
where id = 'test-analyses';
```

## Troubleshooting

- If a migration fails because an object already exists, check if prior partial setup was applied.
- Re-run from the failing file after fixing root cause.
- For auth-related access failures, verify:
  - `user_roles` rows exist for current `auth.uid()`
  - `teachers.user_id` / `students.user_id` are correctly mapped.

