# Task 8 — Deploy to Vercel with env vars + preview branches

**Model:** Claude Sonnet 4.6
**Expected time:** 30–45 minutes
**Risk:** Medium (production)

## Context
Final step: ship the MVP to Vercel so stakeholders can click through it.

## Goal

### 8.1 Create `vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```
The rewrite rule is critical for client-side routing (react-router).

### 8.2 Env vars in Vercel
Walk the user through setting these in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Scope | Value |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | Production, Preview, Dev | `https://jyuajjenppgfafgmrtew.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | All | (from local `.env`) |
| `VITE_SUPABASE_STORAGE_BUCKET` | All | `answer-sheets` |
| `VITE_UPLOAD_MAX_BYTES` | All | `10485760` |
| `VITE_ENABLE_ADMIN_ANALYTICS` | All | `false` |
| `VITE_ENABLE_ADVANCED_TEACHER_TOOLS` | All | `false` |
| `VITE_DEMO_EMAIL_ADMIN` | Preview, Dev only | `admin@school.com` |
| `VITE_DEMO_EMAIL_SCHOOL` | Preview, Dev only | `school@school.com` |
| `VITE_DEMO_EMAIL_TEACHER` | Preview, Dev only | `priya@school.com` |
| `VITE_DEMO_EMAIL_STUDENT` | Preview, Dev only | `aarav.patel@student.com` |
| `VITE_SENTRY_DSN` | Production only | (get from Sentry) |

**Do NOT set demo emails in Production** — demo login should be disabled in prod (add that safety switch in `SchoolContext.jsx`).

### 8.3 Supabase hosted config
Verify in Supabase Dashboard (`jyuajjenppgfafgmrtew`):
- Auth → URL Configuration: add Vercel domain to "Site URL" and "Redirect URLs".
- Storage → Buckets: `answer-sheets` exists and is **private**.
- Database → Migrations applied (run the SQL files in order if needed).
- RLS is enabled on all custom tables.

### 8.4 GitHub → Vercel connection
1. Push repo to GitHub (already at `Techvitta-Master/ai-school`).
2. In Vercel: "New Project" → import the repo → accept defaults.
3. Confirm first preview build passes.
4. Promote a commit to Production.

### 8.5 Post-deploy smoke test
Run the Playwright spec against the live URL by setting `PLAYWRIGHT_BASE_URL=https://your-vercel-url` and `npm run test:e2e`.

## Acceptance criteria
- [ ] Pushing to `main` triggers a production deploy.
- [ ] Opening PRs creates preview deploys.
- [ ] Demo login works on the preview URL.
- [ ] Demo login is disabled on prod.
- [ ] RLS enforces role isolation on prod.

## After completion
Commit with: `chore(deploy): add vercel.json + env scaffolding for production`
