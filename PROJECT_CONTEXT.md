# AI School MVP — Full Project Context

> **Use this file to resume development at any time.**
> Drop it into a Cursor chat as `@PROJECT_CONTEXT.md` and say "continue from here."

---

## 1. What This Project Is

A **single-school student evaluation system** for **Madavi Institute** (classes 6–10).

Teachers upload answer sheets → a dummy AI evaluator produces detailed Root Cause Analysis (RCA) → students view and download branded report cards.

Built as an MVP with:
- **React 19 + Vite 8 + Tailwind CSS 4 + Radix UI** (frontend)
- **Supabase** (Postgres DB + Auth + Storage)
- **Vercel** (hosting — not yet deployed)

---

## 2. Repository

```
GitHub: https://github.com/Techvitta-Master/ai-school
Branch: mvp-build   ← all MVP work is here
```

Clone & run locally:
```bash
git clone https://github.com/Techvitta-Master/ai-school
cd ai-school
git checkout mvp-build
npm install
npm run dev          # opens http://localhost:5173
```

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 (hooks only) |
| Bundler | Vite 8 (Rolldown) |
| Styling | Tailwind CSS 4 + Radix UI |
| Routing | react-router-dom v7 |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| PDF export | react-to-print |
| Backend/DB | Supabase (Postgres + PostgREST) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (`answer-sheets` bucket) |
| Error tracking | Sentry |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright |
| Hosting | Vercel (planned — not yet deployed) |

---

## 4. Supabase Project

```
Project URL:  https://jyuajjenppgfafgmrtew.supabase.co
Anon key:     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5dWFqamVucHBnZmFmZ21ydGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMTc2MzksImV4cCI6MjA5MDY5MzYzOX0._Y5198h9qpF_fOZ4x_e3LWQkOajWqJgnTw0Nv5JO8mk
```

---

## 5. Environment Variables (`.env` at project root)

```env
VITE_SUPABASE_URL=https://jyuajjenppgfafgmrtew.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Feature flags — false = MVP mode (hides non-MVP routes)
VITE_ENABLE_ADMIN_ANALYTICS=false
VITE_ENABLE_ADVANCED_TEACHER_TOOLS=false
```

---

## 6. Demo Login Credentials

| Role | Email | Password | Lands on |
|------|-------|----------|----------|
| Admin | `admin@school.com` | `123456` | `/admin` |
| School Admin | `school@school.com` | `123456` | `/school` |
| Teacher | `priya@school.com` | `123456` | `/teacher` |
| Student | `aarav.patel@student.com` | `123456` | `/student` |

> **Note:** For mutations (add teacher/student/section) to actually save to Supabase, these accounts must be registered as **real Supabase Auth users** via the Register page first. Otherwise the app falls back to a `localStorage` demo mode where writes are silently ignored.

---

## 7. Application Roles & Workflows

```
School Admin ──> add classes (6–10) + add teachers + add students + assign teacher→class
                          │
                          ▼
Teacher ──────────────> see My Class (mapped students) → upload answer sheet (PDF)
                          │
                          ▼
               [evaluationService.js] produces:
                 · marks (55–95 range, dummy)
                 · grade (A+/A/B+/B/C/D)
                 · per-question scores (Q1–Q5)
                 · topic-level RCA (weak / strong topics)
                 · improvement plan (3 steps)
                 · AI feedback text
                          │
                          ▼
Student ──────────────> report card dashboard → Download PDF
```

---

## 8. Project File Structure

```
ai-school/
├── .env                                ← Supabase keys + feature flags
├── .cursor/
│   └── rules/
│       ├── project-conventions.mdc     ← Cursor coding rules
│       ├── react-ui.mdc
│       └── supabase-patterns.mdc
├── AGENTS.md                           ← Always-loaded agent instructions
├── PLAN.md                             ← Full task plan with phases
├── PROJECT_CONTEXT.md                  ← THIS FILE
├── docs/
│   └── cursor-prompts/                 ← Task briefs for Claude
│       ├── 01-seed-madavi.md
│       ├── 02-enhance-eval-rca.md
│       ├── 03-wire-teacher-upload.md
│       ├── 04-teacher-class-view.md
│       ├── 05-student-report-card.md
│       ├── 06-polish-ui.md
│       ├── 07-e2e-tests.md
│       └── 08-vercel-deploy.md         ← NEXT TASK
├── e2e/
│   ├── fixtures/answer-sheet.pdf       ← 1-page PDF for Playwright
│   ├── global-setup.js                 ← Creates PDF fixture
│   ├── happy-path.spec.js              ← Full 14-step E2E test ✅
│   └── smoke.spec.js                   ← Unauthenticated redirect test ✅
├── playwright.config.js                ← workers:1, baseURL:localhost:5173
├── scripts/                            ← Utility SQL + JS scripts
│   ├── backfill-profiles.sql
│   ├── check-auth-users.sql
│   ├── check-roles.sql
│   ├── create-bucket.mjs
│   └── run-migration.mjs
├── src/
│   ├── App.jsx                         ← Routes + ProtectedRoute + AppSkeleton
│   ├── App.roleRouting.test.jsx        ← Vitest routing tests ✅
│   ├── main.jsx
│   ├── index.css                       ← Global CSS + @media print rules
│   ├── components/
│   │   ├── Login.jsx                   ← Demo tab + real auth form
│   │   ├── Register.jsx
│   │   ├── Layout.jsx                  ← Sidebar + hamburger menu (mobile)
│   │   ├── Profile.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── admin/
│   │   │   ├── AdminDashboard.jsx      ← Routes for admin role
│   │   │   ├── AdminOverview.jsx
│   │   │   ├── ManageStudents.jsx
│   │   │   ├── ManageTeachers.jsx
│   │   │   ├── ManageSections.jsx
│   │   │   ├── ManageTests.jsx
│   │   │   └── Performance.jsx
│   │   ├── school/
│   │   │   └── SchoolDashboard.jsx     ← Tabbed UI: Overview/Classes/Teachers/Students/Assign
│   │   ├── teacher/
│   │   │   ├── TeacherDashboard.jsx    ← Router for teacher routes
│   │   │   ├── MyClass.jsx             ← ✅ NEW: Class landing with student table
│   │   │   ├── UploadAnalyze.jsx       ← ✅ Wired to evaluationService
│   │   │   ├── TeacherOverview.jsx
│   │   │   ├── ConductTest.jsx         ← Hidden behind feature flag
│   │   │   └── CompareClasses.jsx      ← Hidden behind feature flag
│   │   ├── student/
│   │   │   ├── StudentDashboard.jsx    ← Router for student routes
│   │   │   ├── StudentScores.jsx       ← ✅ Shows scores + "View Report Card" buttons
│   │   │   ├── ReportCard.jsx          ← ✅ NEW: Printable branded report card
│   │   │   ├── StudentPerformance.jsx
│   │   │   └── StudentImprovement.jsx
│   │   └── ui/                         ← Radix-based UI kit
│   │       ├── button.jsx, card.jsx, badge.jsx
│   │       ├── dialog.jsx, tabs.jsx, select.jsx
│   │       ├── skeleton.jsx, avatar.jsx
│   │       └── ...
│   ├── context/
│   │   └── SchoolContext.jsx            ← Global state: auth + school data + refreshData()
│   └── lib/
│       ├── evaluationService.js         ← ✅ Dummy evaluator with full RCA output
│       ├── evaluationService.test.js    ← ✅ Vitest unit tests (passes)
│       ├── schoolRepository.js          ← All Supabase DB calls
│       ├── schoolEmptyState.js          ← Default empty shape for school data
│       ├── registrationSchools.js       ← School list (Madavi Institute first)
│       ├── resolveCurrentUser.js
│       └── supabaseClient.js
├── supabase/
│   └── sql/                            ← Migrations (run in numeric order)
│       ├── 001_extensions.sql
│       ├── 002_profiles_and_roles.sql
│       ├── 003_core_academics_schema.sql
│       ├── 004_storage_setup.sql
│       ├── 005_rls_policies.sql
│       ├── 006_edge_function_support.sql
│       ├── 007_seed_minimal.sql
│       ├── 008_optional_profile_fields.sql
│       ├── 009_rls_curriculum_reads.sql
│       ├── 010_syllabus_seed.sql
│       ├── 011_demo_seed.sql
│       ├── 012_profiles_registration_columns.sql
│       ├── 013_profile_on_auth_user.sql
│       ├── 014_schools_role.sql
│       ├── 014a_app_role_school_enum.sql
│       ├── 015_answer_sheets.sql
│       ├── 015_evaluations.sql
│       ├── 016_fix_sections_rls.sql
│       ├── 017_fix_has_role.sql
│       ├── 018_madavi_seed.sql          ← Seeds Madavi Institute + classes 6-10
│       └── 019_evaluation_details.sql   ← Adds grade + details JSONB to evaluations
└── vite.config.js
```

---

## 9. Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `profiles` | All users (id, email, name, role, school_id) |
| `schools` | School records (Madavi Institute is default) |
| `sections` | Class sections (e.g., Class 7-A, Class 7-B) |
| `teachers` | Teacher records linked to a school |
| `students` | Student records with roll numbers |
| `teacher_section_assignments` | Maps teacher → class/section/subject |
| `tests` | Test definitions (title, topics, total_marks) |
| `scores` | Student scores per test (summary row) |
| `answer_sheets` | Uploaded PDF references (storage path) |
| `evaluations` | Full RCA output (marks, grade, details JSONB) |

**RLS** is enabled on all tables. Roles: `admin`, `school`, `teacher`, `student`.

---

## 10. What Has Been Built (Completed Tasks)

### ✅ Task 1 — Seed Madavi Institute
- `supabase/sql/018_madavi_seed.sql` inserts Madavi Institute as default school
- Classes 6A through 10B seeded
- `registrationSchools.js` updated to list Madavi first
- `SchoolContext.jsx` updated to try real Supabase Auth before falling back to localStorage demo

### ✅ Task 2 — Enhanced Evaluation RCA
- `evaluationService.js` completely rewritten to produce:
  - `marks` (55–95 range), `grade`, `feedback`
  - `perQuestionScores` (Q1–Q5 with remarks)
  - `topicRCA` (weak topics < 60%, strong topics ≥ 80%)
  - `improvementPlan` (3 actionable steps)
  - `topicScores` (flat map of topic → score)
- Full Vitest suite added (`evaluationService.test.js`) — all tests pass
- `supabase/sql/019_evaluation_details.sql` adds `grade text` and `details jsonb` columns to `evaluations`

### ✅ Task 3 — Wire Teacher Upload
- `UploadAnalyze.jsx` wired to `createAndEvaluate()` from `evaluationService.js`
- Hard-fail if student roll number not found in DB
- `useSearchParams` used to pre-fill roll number from URL (from "Upload Sheet" button in MyClass)
- Result UI displays full RCA: per-question table, topic bars, improvement plan
- Calls `refreshData()` after successful evaluation

### ✅ Task 4 — Teacher My Class View
- New `src/components/teacher/MyClass.jsx`:
  - Shows teacher's assigned classes as pill buttons
  - Lists all students in selected class with roll no, latest score, grade badge
  - "Upload Sheet" button per student → goes to `/teacher/upload?rollNo=X`
  - Empty state when no classes assigned
- Updated routing and sidebar navigation

### ✅ Task 5 — Student Report Card
- New `src/components/student/ReportCard.jsx`:
  - Branded header: "Madavi Institute" + "STUDENT REPORT CARD"
  - Student info: name, class-section, roll no
  - Score hero: large marks, grade badge, progress bar
  - Question-wise breakdown table (Q1–Q5 with scores and remarks)
  - Topic RCA panel (weak/strong with reasons)
  - Improvement plan (numbered list)
  - Teacher feedback callout
  - "Download PDF" button using `react-to-print`
- `StudentScores.jsx` updated with "View Report Card" button that opens modal
- `index.css` has `@media print` block to isolate report card printing

### ✅ Task 6 — UI Polish
- Installed `react-hook-form`, `zod`, `@hookform/resolvers`
- `SchoolDashboard.jsx` forms (Add Teacher, Add Student, Add Section) use `zod` schemas + inline error messages
- `App.jsx` has `AppSkeleton` component (replaces "Loading..." during auth)
- `Layout.jsx` has mobile hamburger menu (sidebar collapses on < md screens)
- Feature flags `VITE_ENABLE_ADMIN_ANALYTICS` and `VITE_ENABLE_ADVANCED_TEACHER_TOOLS` gate non-MVP routes
- All 19 Vitest tests pass

### ✅ Task 7 — Playwright E2E Tests
- `e2e/happy-path.spec.js` — 14-step full workflow test:
  1. School admin logs in
  2. Admin adds Class 7-B section
  3. Admin adds E2E Teacher
  4. Admin adds E2E Student (roll 777)
  5. Admin assigns teacher to Class 7-B
  6. Admin logs out
  7. Teacher logs in
  8. Teacher navigates to Upload & Analyze
  9. Teacher fills roll number + selects test + attaches PDF
  10. Teacher submits and sees evaluation result
  11. Teacher logs out
  12. Student logs in
  13. Student sees scores dashboard (or empty state)
  14. Student views report card (or empty state)
- `playwright.config.js` set to `workers: 1` (prevents Windows race conditions)
- `npm run test:e2e` → **2/2 green in ~21 seconds**

---

## 11. What Is NOT Done Yet

### ⏳ Task 8 — Vercel Deploy (NEXT TASK)
- Task brief: `@docs/cursor-prompts/08-vercel-deploy.md`
- Steps:
  1. Create `vercel.json` with SPA rewrite rule
  2. Connect GitHub repo to Vercel
  3. Set environment variables in Vercel dashboard
  4. Add Vercel domain to Supabase Auth redirect URLs
  5. Promote to production
- **To execute:** Say `@docs/cursor-prompts/08-vercel-deploy.md Please execute this task end-to-end.`

### 🔮 Phase 2 Backlog (after MVP)
1. **Real OCR + LLM** — replace dummy evaluator with Gemini 2.0 Flash
2. **Parent login** — read-only view via parent email linked to student
3. **WhatsApp / SMS alerts** — notify parents when report card is ready
4. **Multi-school onboarding** — self-serve school registration
5. **Bulk CSV upload** — teacher uploads class roster
6. **Admin analytics** — trends, at-risk students list

---

## 12. Available NPM Commands

```bash
npm run dev          # Start dev server → http://localhost:5173
npm run build        # Production build (Vite/Rolldown — may crash on Windows; use dev mode)
npm run test         # Vitest unit tests (19 tests, all green)
npm run test:e2e     # Playwright E2E (2 tests, all green — needs dev server running first)
npm run lint         # ESLint
```

---

## 13. Architecture Rules (Do Not Break)

1. **No custom backend** — all server logic is in Postgres RLS / Supabase. Never add Express/Next API routes without explicit approval.
2. **Data access only through repositories** — call `schoolRepository.js` or `evaluationService.js`. Never call `supabase.from()` directly from components.
3. **Every new table needs RLS policies** in a new `supabase/sql/NNN_*.sql` migration.
4. **Global state lives in `SchoolContext.jsx`** — no Redux, Zustand, or React Query.
5. **Dummy evaluator stays pluggable** — don't integrate real OCR/LLM until explicitly requested.
6. **Parent role = Phase 2** — do not add parent-role code now.
7. **Never commit `.env`** or any credentials.

---

## 14. Key Design Decisions Made

| Decision | Rationale |
|----------|-----------|
| Dummy evaluator (no real AI yet) | MVP focus; easier to demo; pluggable later |
| Single school (Madavi Institute) | Simplify RLS + UX; multi-school scaffolding still exists underneath |
| Supabase over custom backend | No DevOps overhead; built-in Auth + RLS + Storage |
| react-hook-form + zod | Type-safe form validation without heavy libraries |
| react-to-print for PDF | No canvas/jsPDF complexity; pure HTML print |
| workers:1 in Playwright | Windows Vite dev server has race conditions under parallel load |
| Feature flags for non-MVP routes | Keep code, just hide it — easy to enable later |
| Demo login attempts real Supabase Auth first | Ensures RLS works when demo accounts are registered |

---

## 15. Known Issues / Limitations

| Issue | Status |
|-------|--------|
| `vite build` crashes on Windows (Rolldown exit code -1073741819) | Known Vite 8 Windows bug; use dev server for testing |
| Demo mutations (add teacher etc.) silently fail if demo user not in Supabase Auth | By design in localStorage demo mode; fix = register demo accounts |
| No tests in DB → Upload submit button disabled | Gracefully handled in E2E test; seed tests to enable real flow |
| Student profile "not set up" on demo login | Demo student `aarav.patel@student.com` needs to be registered + enrolled |
| Vercel not deployed yet | Task 8 is the next step |

---

## 16. Git Commit History (mvp-build branch)

```
160de52  chore: add remaining scripts, sql migrations, docs, cursor rules and fixtures
367dbaa  test(e2e): add full school→teacher→student happy path
f18f408  chore(ui): polish forms with zod validation, add empty states, gate advanced routes
df00bdc  feat(student): add branded report card with PDF download
4fab77b  feat(teacher): add workflow-first MyClass landing view with per-student upload shortcut
196b4a7  feat(teacher): wire answer-sheet upload to evaluationService with RCA output
86e8820  fix(db): 019 creates evaluations table if missing before adding RCA columns
78fb305  feat(eval): produce detailed RCA output from dummy evaluator
c602714  feat(db): seed Madavi Institute as default school with classes 6-10
```

---

## 17. How to Resume With Claude

Drop this file into Cursor chat and say one of the following:

**Continue with Vercel deployment:**
```
@PROJECT_CONTEXT.md @docs/cursor-prompts/08-vercel-deploy.md
Please execute Task 8 end-to-end.
```

**Fix a specific bug:**
```
@PROJECT_CONTEXT.md
The [describe problem]. Here is the error: [paste error].
Please fix it.
```

**Add a new feature:**
```
@PROJECT_CONTEXT.md
I want to add [feature description].
Plan it first, then implement.
```

**Run the tests:**
```bash
# Unit tests
npm run test

# E2E (start dev server first in a separate terminal)
npm run dev
npm run test:e2e
```

---

_Last updated: 2026-04-17 | Branch: mvp-build | Supabase: jyuajjenppgfafgmrtew_
