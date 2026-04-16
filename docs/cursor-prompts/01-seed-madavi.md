# Task 1 — Seed Madavi Institute as the default school

**Model:** Claude Sonnet 4.6
**Expected time:** 20–30 minutes
**Risk:** Low

## Context
Single-school MVP. We want "Madavi Institute" to be the authoritative school for this deployment while preserving multi-school scaffolding for Phase 2.

## Goal
1. Create a new Supabase migration that seeds the `schools` table with "Madavi Institute" and populates classes 6–10 with sections A and B each.
2. Update `src/lib/registrationSchools.js` so Madavi Institute appears first in the dropdown with a hardcoded UUID.
3. Add Madavi as the default `schoolId` for the demo school user in `SchoolContext.jsx`.
4. Do NOT remove existing schools from the scaffolding — they remain for future multi-tenant expansion.

## Acceptance criteria
- [ ] New file `supabase/sql/018_madavi_seed.sql` exists and is idempotent (`on conflict do nothing`).
- [ ] Migration seeds: 1 school, 5 classes × 2 sections = 10 section rows.
- [ ] `registrationSchools.js` lists Madavi as the first option.
- [ ] Demo school user's `schoolId` matches Madavi's UUID.
- [ ] `npm run build` succeeds with no errors.

## Hints
- Use UUID `d0000000-0000-4000-8000-000000000001` for Madavi (pattern matches existing fixture UUIDs in `014_schools_role.sql`).
- Section class_name is stored as text, e.g. `'6'`, `'7'`.
- Verify by logging in as the school demo user and confirming all 10 sections appear under Classes tab.

## After completion
Commit with: `feat(db): seed Madavi Institute as default school with classes 6-10`
