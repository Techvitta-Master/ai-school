# Task 6 — UI polish: empty states, validation, hidden advanced routes

**Model:** Claude Sonnet 4.6
**Expected time:** 60–90 minutes
**Risk:** Low

## Context
Before shipping, harden the UI: consistent empty states, form validation, mobile responsiveness, and gate advanced features behind env flags.

## Goal

### 6.1 Hide non-MVP routes behind env flags
In `.env`:
```
VITE_ENABLE_ADMIN_ANALYTICS=false
VITE_ENABLE_ADVANCED_TEACHER_TOOLS=false
```

Update `src/components/Layout.jsx` `roleConfig` to conditionally include menu items based on these flags. Also update `AdminDashboard.jsx` and `TeacherDashboard.jsx` to not register disabled routes.

Items to hide for MVP:
- Admin → Performance (BarChart3) — analytics
- Admin → Tests — test creation is teacher-driven in MVP
- Teacher → Conduct Test
- Teacher → Compare Classes

### 6.2 Form validation
Install `react-hook-form` + `zod` + `@hookform/resolvers`:
```bash
npm install react-hook-form zod @hookform/resolvers
```

Convert the three CRUD forms in `SchoolDashboard.jsx`:
- Add Teacher: name (2-60 chars), email (email), subject (non-empty)
- Add Student: name, email, rollNo (integer 1–9999), class (6-10), section (A-D)
- Add Section: class (6-10), section (A-D)

Show inline red error text under each invalid field.

### 6.3 Empty states for all data lists
Audit every component rendering `data.X.map()` and add an empty state matching this template:

```jsx
{items.length === 0 ? (
  <div className="text-center py-16 text-slate-400">
    <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
    <p className="text-sm font-medium">{emptyTitle}</p>
    <p className="text-xs mt-1">{emptyHint}</p>
  </div>
) : ( /* list */ )}
```

### 6.4 Loading skeletons
Replace any `"Loading..."` text with `Skeleton` primitive (already in `src/components/ui/skeleton.jsx`). Use on:
- Initial data load in SchoolContext (show skeleton grids)
- Upload in progress (already has spinner — leave as is)

### 6.5 Mobile responsive audit
- Sidebar in `Layout.jsx`: on screens < 768px, hide by default, show a hamburger menu toggle.
- Dashboard stat grids: already `grid-cols-2 md:grid-cols-4` — verify on mobile.
- Tables with many columns: add `overflow-x-auto` wrappers.

### 6.6 Error boundary
The existing `ErrorBoundary.jsx` is fine. Verify Sentry DSN is pluggable via env.

## Acceptance criteria
- [ ] Advanced routes no longer appear in sidebars when env flag is `false`.
- [ ] Form errors appear inline below invalid fields.
- [ ] Every list has an empty state.
- [ ] Sidebar collapses to hamburger on mobile.
- [ ] `npm run build` and `npm run test` both pass.

## After completion
Commit with: `chore(ui): polish forms with zod validation, add empty states, gate advanced routes`
