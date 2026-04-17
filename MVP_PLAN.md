# Portal MVP — requirements & status

Simple four-role product. **Role order (highest → lowest):** admin → school → teacher → student.

See also: [`PLAN.md`](./PLAN.md) (longer production roadmap / history).

---

## 1. Admin

**Portal:** login → dashboard → create and manage schools.

| Requirement | Status |
|-------------|--------|
| Login | Done |
| Dashboard (overview + metrics) | Done |
| Create school | Done |
| Delete school (UI + API, admin-only) | Done |

**Out of scope for admin MVP:** anything beyond schools (no teacher/student management here).

---

## 2. School

**Portal:** login → dashboard → classes, students, teachers; map students to class; map students to teachers (subject-wise); assign teachers to classes (per subject).

| Requirement | Status |
|-------------|--------|
| Login | Done (seed user) |
| Dashboard | Partial — verify against requirements |
| Create / manage classes (sections) | Pending polish |
| Create / manage students & teachers | Pending polish |
| Map student ↔ class | Pending |
| Map student ↔ teacher (subject) | Pending |
| Assign teacher ↔ class/section (per subject) | Pending |

---

## 3. Teacher

**Portal:** login → dashboard → **Upload & Analyze** → roll number → test → PDF → submit → see evaluation.

| Requirement | Status |
|-------------|--------|
| Login | Done (seed user) |
| Dashboard | Partial |
| Upload & Analyze flow | Partial (dummy evaluator) |

---

## 4. Student

**Portal:** login → scores dashboard → report card.

| Requirement | Status |
|-------------|--------|
| Login | Done (seed user) |
| Scores dashboard | Partial |
| Report card view | Pending polish |

---

## Technical notes (current stack)

- **Frontend:** React + Vite; optional Node API for mutations/list calls.
- **Data:** Supabase Postgres; **RLS disabled** for this MVP — enforce **admin vs non-admin** on the Node API where routes exist; UI restricts admin actions to admin role.
- **Demo accounts:** seeded via `npm run seed:auth` (see `.env` `VITE_DEMO_*`).

---

## What we finished first

**Admin slice is complete** for this MVP definition: dashboard + create/delete schools, admin-only on API for school writes/deletes.

---

## Recommended next focus

1. **School role:** end-to-end flows for classes, students, teachers, and all mappings (single school context).
2. **Teacher:** tighten Upload & Analyze + roll lookup + evaluation display.
3. **Student:** scores + report card UX.

_Last updated: 2026-04-17_
