# AI School MVP — Production Plan

> Single-school (Madavi Institute) evaluation system.
> Built with React + Supabase + Vercel.
> Driven by Claude Sonnet 4.6 via Cursor agents.

**Simplified MVP requirements & role checklist:** see [`MVP_PLAN.md`](./MVP_PLAN.md).

---

## 0. Locked-in decisions

| Area | Decision |
|------|----------|
| OCR / LLM engine | **Dummy evaluator** (random 60–95 + fixed feedback) — pluggable for real AI later |
| Parent login | **Phase 2** (not in MVP) |
| Evaluation output | **Detailed RCA** — per-question + topic-level weakness + improvement plan + downloadable report card |
| School identity | **Seed Madavi Institute**, keep multi-school scaffolding underneath |
| Hosting | **Vercel** (frontend) + **Supabase hosted** (`jyuajjenppgfafgmrtew.supabase.co`) |

---

## 1. Workflow (matches your spreadsheet)

```
School Admin ─┬──> create classes (6–10)
              ├──> add teachers (by subject)
              ├──> add students (by roll no)
              └──> map teacher ↔ class/section/subject
                           │
                           ▼
Teacher ──────┬──> see assigned class + students
              ├──> pick student by roll no
              ├──> upload answer sheet (PDF/JPG/PNG → Supabase Storage)
              └──> trigger dummy AI evaluation
                           │
                           ▼
            [evaluationService.js] produces:
              · total marks (0–100)
              · grade (A+/A/B+/…)
              · per-question scores
              · topic-level RCA (weak / strong)
              · improvement plan
                           │
                           ▼
Student ─────────────> sees report card + download PDF
```

---

## 2. Gap analysis — what's already done vs what's left

### ✅ Already shipped
- React 19 + Vite 8 + Tailwind 4 + Radix UI shell
- Supabase schema (schools, sections, teachers, students, `teacher_section_assignments`, tests, scores, `answer_sheets`, `evaluations`)
- RLS policies for all tables
- Storage buckets (`answer-sheets`, `test-analyses`)
- Role-based routing (admin / school / teacher / student)
- **School Admin Dashboard** (tabbed UI — Overview / Classes / Teachers / Students / Assign)
- **Teacher Upload & Analyze** (roll-no input + file drop + submit)
- **Student Scores** with AI-feedback section
- `evaluationService.js` with `evaluateAnswerSheet()` + `createAndEvaluate()` dummy implementation
- Sentry error boundary + Vitest + Playwright scaffolding

### ✅ Current requirements checklist (2026-04-17)
- [x] Node API layer in place for frontend-to-backend calls
- [x] Login is strict API-first (failed login does not enter app)
- [x] Demo credentials aligned and seeded for 4 roles (admin/school/teacher/student)
- [x] Old data wiped; DB reset to minimal state with Madavi baseline
- [x] Admin surface reduced to dashboard + schools management
- [x] Admin dashboard copy updated to client-facing language
- [x] Meaningful cards added: Total Schools, Latest Activity, School Status
- [x] Admin: delete school (UI + `DELETE /api/schools/:id`, admin-only)
- [x] Proxy removed from Vite path; direct API base URL used
- [x] RLS disabled on public tables (access control shifted to Node layer)
- [ ] Node API authorization hardening per endpoint (school/teacher/student routes)
- [ ] **MVP_PLAN.md — School role:** classes, students, teachers, mappings
- [ ] **MVP_PLAN.md — Teacher:** Upload & Analyze end-to-end
- [ ] **MVP_PLAN.md — Student:** scores + report card
- [ ] End-to-end test for full happy path

### ❌ To build for MVP
| # | Gap | Phase |
|---|-----|-------|
| 1 | Seed Madavi Institute + make it the default school for new users | 1 |
| 2 | Enhance `evaluationService` to produce detailed RCA (per-question, topic analysis, improvement plan) | 2 |
| 3 | Wire teacher upload form → `createAndEvaluate()` → write to `evaluations` table | 2 |
| 4 | Add "My Class" view for teacher: shows mapped students with roll numbers | 2 |
| 5 | Build student Report Card component (printable, branded, downloadable PDF) | 3 |
| 6 | Hide / remove non-MVP routes (ConductTest, CompareClasses, Admin multi-tenant controls) | 4 |
| 7 | Empty / loading / error states polish; form validation with zod | 4 |
| 8 | E2E tests: school→teacher→student happy path | 5 |
| 9 | Vercel deploy with env vars + preview branches | 6 |

---

## 3. Repository structure after MVP

```
ai-school/
├── .cursor/
│   └── rules/                      ← persistent guidance for Claude
│       ├── project-conventions.mdc
│       ├── supabase-patterns.mdc
│       └── react-ui.mdc
├── AGENTS.md                       ← repo-level agent guide (NEW)
├── PLAN.md                         ← this file
├── docs/
│   └── cursor-prompts/             ← copy-paste prompts for each task
│       ├── 01-seed-madavi.md
│       ├── 02-enhance-eval-rca.md
│       ├── 03-wire-teacher-upload.md
│       ├── 04-teacher-class-view.md
│       ├── 05-student-report-card.md
│       ├── 06-polish-ui.md
│       ├── 07-e2e-tests.md
│       └── 08-vercel-deploy.md
├── src/
│   ├── components/
│   │   ├── student/
│   │   │   └── ReportCard.jsx      ← NEW
│   │   └── teacher/
│   │       └── MyClass.jsx         ← NEW
│   └── lib/
│       └── evaluationService.js    ← EXTEND with RCA output
├── supabase/sql/
│   └── 018_madavi_seed.sql         ← NEW
└── vercel.json                     ← NEW
```

---

## 4. Phased task board (assignable to Claude 4.6)

Each phase has a dedicated prompt in `docs/cursor-prompts/` you can drop into Cursor chat with `@docs/cursor-prompts/01-seed-madavi.md`.

### Phase 0 — Cursor setup (30 min, one-time)
- [x] Create `AGENTS.md`
- [x] Create `.cursor/rules/*.mdc`
- [x] Create this `PLAN.md`
- [x] Create `docs/cursor-prompts/*.md`

### Phase 1 — Data foundation (1–2 h)
- [ ] **Task 1.1** Seed "Madavi Institute" in `schools` table → `supabase/sql/018_madavi_seed.sql`
- [ ] **Task 1.2** Seed classes 6–10, sections A & B each
- [ ] **Task 1.3** Update `registrationSchools.js` to default to Madavi
- [ ] **Task 1.4** Remove parent role references (currently nil, verify)

### Phase 2 — Teacher flow (2–3 h)
- [ ] **Task 2.1** Upgrade `evaluationService.js`:
  - Accept `{ testId, studentId, teacherId, storagePath }`
  - Return `{ marks, grade, perQuestionScores[], topicRCA{weak[], strong[]}, improvementPlan[], feedback }`
  - Write full payload to `evaluations` (extend schema: add `details jsonb`)
- [ ] **Task 2.2** Replace `UploadAnalyze.jsx` backend call:
  - Resolve roll number → `students.id` via Supabase lookup
  - Call `createAndEvaluate()` instead of `supabase.functions.invoke('analyze_test')`
  - Persist storage path before evaluation
- [ ] **Task 2.3** Build `MyClass.jsx` — teacher lands here first:
  - Shows class/section from `teacher_section_assignments`
  - Lists mapped students with roll no + latest score
  - "Upload answer sheet" button per student

### Phase 3 — Student report card (2–3 h)
- [ ] **Task 3.1** Build `ReportCard.jsx`:
  - School logo + Madavi Institute branding
  - Student details (name, class, roll no)
  - Test title + total marks + grade (large)
  - Per-question breakdown table
  - Topic RCA (weak areas with traffic lights)
  - Improvement plan list
  - "Teacher feedback" callout
  - Print-optimized CSS (`@media print`)
- [ ] **Task 3.2** Add PDF export using `react-to-print` or `html2canvas + jsPDF`
- [ ] **Task 3.3** Wire `StudentScores.jsx` history → click row opens `ReportCard.jsx` in modal/route

### Phase 4 — Polish (1–2 h)
- [ ] **Task 4.1** Hide non-MVP routes from sidebars (ConductTest, CompareClasses, Admin analytics) behind `VITE_ENABLE_*` env flags
- [ ] **Task 4.2** Install `zod` + `react-hook-form`; convert Add-Teacher / Add-Student / Add-Section forms
- [ ] **Task 4.3** Add empty-state illustrations + skeleton loaders to every data list
- [ ] **Task 4.4** Mobile responsive audit (sidebar collapses to bottom nav on <640px)

### Phase 5 — QA + deployment (1–2 h)
- [ ] **Task 5.1** Write Playwright e2e: `login → add teacher → add student → assign → teacher uploads → student sees report`
- [ ] **Task 5.2** Create `vercel.json` + configure env vars in Vercel dashboard
- [ ] **Task 5.3** Push to GitHub → auto-deploy preview → promote to prod
- [ ] **Task 5.4** Smoke test on deployed URL with live Supabase

---

## 5. How to drive this with Claude Sonnet 4.6 in Cursor

You have three execution modes. Pick per-task based on risk:

### Mode A — One-shot agent (fastest, for low-risk tasks)
Open Cursor chat → `@docs/cursor-prompts/01-seed-madavi.md` → "Please execute this task"
Cursor's default agent (make sure it's set to Claude 4.6 Sonnet in Settings → Models) will read the prompt, make changes, and show a diff.

### Mode B — Background task agent (for parallel work)
Use Cursor's "Background Agents" feature:
1. Cmd/Ctrl-K → "Run Background Agent"
2. Point to `docs/cursor-prompts/0N-*.md`
3. Let it run while you work on something else
4. Review PR when done

### Mode C — Manual tight-loop (for high-risk tasks like RLS changes)
Paste the prompt into chat, but add: "Show me the plan before editing anything." Then approve each diff individually.

**Recommended sequencing:**
1. Phase 1 & 4 tasks → Mode A (simple)
2. Phase 2 & 3 tasks → Mode C (touches data + UX)
3. Phase 5 deployment → Mode C (production)

---

## 6. Cursor primitives used in this repo

| Primitive | Where | Why |
|-----------|-------|-----|
| **AGENTS.md** | repo root | Always-included system message for ANY agent working here |
| **.cursor/rules/*.mdc** | repo | Targeted rules (auto-attached to matching globs) |
| **Skills** | `.agents/skills/` | Already have `supabase` + `postgres-best-practices` — Claude auto-invokes |
| **MCP: plugin-supabase** | Already configured | Claude can run Supabase queries directly |
| **docs/cursor-prompts** | repo | Human-readable, versioned, reusable task briefs |

You do **not** need custom hooks or new skills for this MVP.

---

## 7. Success criteria (MVP done = all green)

- [ ] Fresh clone + `npm install` + `npm run dev` → lands on Madavi login screen
- [ ] School admin can: add a class, add a teacher, add a student (with roll no), assign teacher→class
- [ ] Teacher sees only their mapped students, can upload answer sheet, sees detailed AI evaluation instantly
- [ ] Student sees their report card with per-question breakdown, can download as PDF
- [ ] Node API authorization prevents Teacher A from seeing Teacher B's students
- [ ] Deployed to `ai-school-main.vercel.app` (or your equivalent) and fully functional

---

## 8. After MVP — Phase 2 backlog

1. Real OCR+LLM (Gemini 2.0 Flash recommended — $0.10 per 1M input tokens)
2. Parent login (reuse student row via `parent_email` column; magic-link auth)
3. WhatsApp/SMS alerts to parents when report is ready
4. Multi-school onboarding flow (self-serve)
5. Teacher bulk upload via CSV
6. Analytics dashboard for school admin (trends, risk list)

---

_Last updated: 2026-04-16_
