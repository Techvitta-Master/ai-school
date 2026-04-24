# AI School — Project Overview

## What the App Does

**AI School** (package name: `school-eval-app`) is a **single-school–focused student evaluation portal** branded as **Madavi Institute**, targeting grades 6–10.

Four roles interact with the system:git checkout feature/my-friends-branchgit checkout feature/my-friends-branchgit checkout feature/my-friends-branch

| Role | Capabilities |
|------|-------------|
| **Admin** | Create/delete schools, view overall overview |
| **School** | Manage classes, subjects, teachers, students; assign teachers to classes |
| **Teacher** | View assigned class/students, add tests, upload answer sheets, run evaluations that generate scores, grades, per-question RCA, and improvement plans |
| **Student** | View scores, performance breakdowns, improvement suggestions, printable report card |

---

## Tech Stack

| Area | Technology |
|------|------------|
| UI Framework | React 19 (hooks) |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 + Radix UI primitives |
| Routing | react-router-dom v7 |
| Forms / Validation | react-hook-form + zod |
| Backend / Database | Supabase (Postgres via PostgREST, Auth, Storage) |
| Charts | recharts |
| Print | react-to-print |
| Observability | Sentry (optional via `VITE_SENTRY_DSN`) |
| Testing | Vitest + Testing Library (unit), Playwright (e2e) |
| Deployment | Vercel (SPA rewrite via `vercel.json`) |

> There is **no Next.js and no custom HTTP API**. The React app talks directly to Supabase from the browser.

---

## Folder Structure

```
ai-school/
├── src/                        # Main application source
│   ├── main.jsx                # Entry point — mounts React, optional Sentry, ErrorBoundary
│   ├── App.jsx                 # BrowserRouter, SchoolProvider, role-guarded routes
│   ├── context/
│   │   └── SchoolContext.jsx   # Central state: auth session, hydrated school data, helpers
│   ├── components/
│   │   ├── admin/              # AdminDashboard — school overview & management
│   │   ├── school/             # SchoolDashboard — classes, teachers, students, assignments
│   │   ├── teacher/            # TeacherDashboard — class view, tests, upload, analytics
│   │   ├── student/            # Scores, performance, improvement, report card
│   │   ├── ui/                 # Shared Radix + Tailwind primitives (Button, Card, Dialog…)
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Profile.jsx
│   │   └── Layout.jsx
│   ├── services/
│   │   ├── schoolService.js    # Bulk loadSchoolData + CRUD for normalized tables
│   │   ├── teacherService.js   # Teacher-specific DB operations
│   │   ├── studentService.js   # Student-specific DB operations
│   │   ├── authService.js      # Supabase signIn / signOut
│   │   └── schoolDataMapper.js # DB rows → UI-friendly shape
│   ├── lib/
│   │   ├── supabaseClient.js   # Supabase client singleton
│   │   ├── resolveCurrentUser.js # Maps auth user → role/school/teacher/student IDs
│   │   ├── evaluationService.js  # Dummy evaluation builder + persistDummyEvaluation
│   │   ├── schoolRepository.js   # Re-exports and legacy wrappers
│   │   └── schoolEmptyState.js   # Default empty state shapes
│   └── data/
│       └── data-ch.json        # Syllabus reference data for seed generation
│
├── supabase/
│   ├── config.toml             # Supabase CLI config
│   ├── sql/                    # Numbered SQL migrations (027–034 in repo)
│   │   └── README.md           # Full ordered migration sequence (001–015+) for fresh setup
│   └── functions/              # Supabase Edge Functions (TypeScript)
│       ├── create-user/        # Privileged user creation
│       ├── create-school/      # Privileged school creation
│       └── delete-user/        # Privileged user deletion
│
├── scripts/                    # Node utility scripts
│   │                           # (migrations, seed auth users, e2e runner, syllabus gen…)
│
├── e2e/                        # Playwright end-to-end tests
│   ├── happy-path.spec.js
│   └── smoke.spec.js
│
├── docs/cursor-prompts/        # Task-oriented AI prompts (not runtime code)
├── .cursor/                    # Editor rules and MCP config
├── .github/workflows/          # CI (ci.yml)
├── AGENTS.md                   # Architecture rules and conventions for AI agents
├── PROJECT_CONTEXT.md          # Project intent and context (treat as sensitive)
├── PLAN.md / MVP_PLAN.md       # Roadmap and MVP checklist
├── vite.config.js              # Vite config — path alias `@` → `src`
├── vercel.json                 # Vercel SPA rewrite
└── package.json                # Dependencies and scripts
```

---

## Data Model

### Core Tables (Postgres via Supabase)

| Table | Description |
|-------|-------------|
| `schools` | School records; `created_by` links to the school admin |
| `classes` | Classes within a school |
| `subjects` | Subjects taught |
| `teachers` | Teacher profiles; linked to `auth.users` via `user_id` |
| `students` | Student profiles; linked to `auth.users` via `user_id` |
| `teacher_classes` | Many-to-many: which teacher teaches which class |
| `tests` | Tests created by teachers |
| `results` | Evaluation results: marks, percentage, per-question data |
| `users` | Public user table storing role (`admin`, `school`, `teacher`, `student`) |

### Row-Level Security (RLS)

RLS is enabled on all tables. Helper functions enforce tenant isolation:

- `is_admin()` — checks if user has admin role
- `is_school_admin(p_school_id)` — checks school ownership
- `teacher_school_id()` — resolves teacher's school
- `student_school_id()` — resolves student's school

---

## Application Flow

```
Browser (React SPA)
      │
      ├─── Supabase Auth ──────────────── Login / session management
      │
      ├─── PostgREST (Supabase DB) ────── CRUD on all tables (RLS enforced)
      │
      ├─── Supabase Storage ───────────── Answer sheet uploads (answer-sheets bucket)
      │
      └─── Supabase Edge Functions ────── Privileged ops (create-user, create-school, delete-user)
```

### Step-by-Step Flow

#### 1. Authentication
- User lands on `/login`
- `authService.signInWithPassword` → Supabase Auth session cookie set
- `SchoolContext` subscribes to the session via `onAuthStateChange`
- `resolveCurrentUser` runs: reads `public.users` for role, then joins the relevant profile table (`teachers`, `students`, or `schools`)

#### 2. Data Hydration
- `loadSchoolData(supabase, { schoolId })` fires **parallel** queries for all tables
- Results are mapped through `mapSchoolRowsToUiData` into a normalized UI shape
- The result is stored in `SchoolContext` state and accessible via `useSchool()` hook anywhere in the tree

#### 3. Role-Based Routing (`App.jsx`)
- Routes are guarded by role:
  - `/admin` → `AdminDashboard`
  - `/school` → `SchoolDashboard`
  - `/teacher` → `TeacherDashboard`
  - `/student` → Student views

#### 4. Mutations
- Components call service/repository functions (not raw `supabase.from()` directly)
- Services handle insert/update/delete, then local context state is refreshed

#### 5. Teacher Evaluation Flow
1. Teacher opens **UploadAnalyze** and uploads an answer sheet to Supabase Storage
2. `evaluationService.buildEvaluation()` computes scores, grades, per-question RCA, and an improvement plan **in the browser** (no real AI/LLM yet — placeholder logic)
3. `persistDummyEvaluation` → `upsertResult` writes the result into the `results` table

#### 6. Student Report Card
- Student views read from `results` joined with `tests`, `subjects`, and `classes`
- `react-to-print` enables a printable report card view

---

## Key Conventions

| Convention | Detail |
|------------|--------|
| **State management** | All app state via `useSchool()` context — no Redux or React Query |
| **Path alias** | `@` resolves to `src/` (configured in `vite.config.js`) |
| **Service layer** | New code must use service/repository functions, not raw `supabase.from()` in components |
| **UI components** | Radix UI + Tailwind; `lucide-react` icons use `createElement` to avoid HMR issues |
| **Feature flags** | Advanced teacher tools gated by `VITE_ENABLE_ADVANCED_TEACHER_TOOLS` env var |
| **Commit style** | Conventional commits (`feat:`, `fix:`, `chore:`, etc.) |
| **Tests** | Unit tests with Vitest; e2e with Playwright under `e2e/` |
| **RLS** | All multi-tenant isolation enforced at the DB layer via Postgres RLS policies |

---

## Current Limitations / Roadmap Notes

- The **evaluation engine is a placeholder** — it generates structured RCA-shaped output but uses no real OCR or LLM. A real AI integration is planned.
- The `README.md` at the root is the default Vite template blurb — actual project docs are in `AGENTS.md`, `PROJECT_CONTEXT.md`, `PLAN.md`, and `MVP_PLAN.md`.
- Some SQL migrations in the repo are a **subset** (027–034); a full ordered sequence (001–015+) documented in `supabase/sql/README.md` must be run when bootstrapping a fresh environment.
- `PROJECT_CONTEXT.md` may contain live credentials — prefer environment variables and treat this file as sensitive.
