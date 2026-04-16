# AGENTS.md — Claude / Cursor guide for the AI School MVP

This file is automatically included in the context of any AI agent working in this repo. Read it fully before making changes.

## Project in one paragraph

Single-school ("Madavi Institute") student evaluation system. Classes 6 through 10, each with sections and teachers. Teachers upload answer sheets; a dummy evaluator produces detailed RCA (root-cause analysis) output; students view and download report cards. Built on React 19 + Vite 8 + Tailwind 4 + Supabase (Postgres + Storage + Auth). Deployed on Vercel.

Always refer to [`PLAN.md`](./PLAN.md) for the authoritative task list.

## Architecture boundaries

```
React (Vite)  ──PostgREST──>  Supabase Postgres   (RLS enforced)
     │
     └────── Storage API ───>  Supabase Storage    (answer-sheets bucket)
     │
     └────── Auth API ──────>  Supabase Auth       (magic-link + password)
```

- No custom backend / Express / Next API routes. All server logic lives in Postgres (RLS + RPC) or Supabase Edge Functions.
- Do **NOT** add a Node backend without explicit user approval.

## Coding conventions

### React
- Use **React 19** with hooks. No class components (except existing ErrorBoundary).
- Co-locate components in `src/components/<role>/`.
- Use Radix UI + Tailwind. New UI primitives go in `src/components/ui/`.
- Use `createElement` pattern already in use for `lucide-react` icons to avoid Vite HMR issues.
- Path alias `@` → `./src`.

### Tailwind
- Prefer `rounded-2xl`, `border border-slate-200`, soft backgrounds (`bg-slate-50`).
- Color palette: indigo (primary), emerald (success), amber (warn), red (danger), purple (secondary).
- Use `shadow-sm` for cards, never `shadow-lg`.

### Supabase
- All inserts/updates/deletes go through `src/lib/schoolRepository.js` or `src/lib/evaluationService.js`. Do NOT call `supabase.from()` directly from components.
- Any new table needs matching RLS policies in a new `supabase/sql/NNN_*.sql` migration (increment the number).
- Test RLS by logging in as different roles in the demo users.

### State management
- Global state lives in `src/context/SchoolContext.jsx` via `useSchool()`.
- Do not introduce Redux, Zustand, or React Query without asking.

### Styling new components
- Start from `src/components/school/SchoolDashboard.jsx` as the reference pattern.
- Use `FormInput`, `FormSelect` helpers already defined there.

## Demo credentials (dev only)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@school.com` | `123456` |
| School | `school@school.com` | `123456` |
| Teacher | `priya@school.com` | `123456` |
| Student | `aarav.patel@student.com` | `123456` |

## Commands

```bash
npm run dev          # vite dev server on :5173
npm run build        # production build
npm run test         # vitest unit tests
npm run test:e2e     # playwright
npm run lint         # eslint
```

## What NOT to do

- ❌ Don't break existing RLS — every new migration must preserve teacher/student isolation.
- ❌ Don't add parent-role code — Phase 2 only.
- ❌ Don't replace the dummy evaluator yet — keep it pluggable but leave real OCR/LLM for later.
- ❌ Don't create `.md` docs unless explicitly requested.
- ❌ Don't commit `.env` or any key.

## When stuck

1. Re-read [`PLAN.md`](./PLAN.md) — it has the task list.
2. Re-read `.cursor/rules/*.mdc` — they have coding conventions.
3. The `supabase` skill (under `.agents/skills/supabase/`) auto-loads for any Supabase work.

## Commit style

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`.
- One focused change per commit.
- Never commit WIP or broken builds.
