# Task 7 — Playwright E2E happy-path test

**Model:** Claude Sonnet 4.6
**Expected time:** 45–60 minutes
**Risk:** Low

## Context
We need at least one end-to-end test that covers the full workflow. This becomes the MVP smoke test — if it passes, we can deploy.

## Goal

Create `e2e/happy-path.spec.js` testing:

```
1. School admin logs in (school@school.com / 123456)
2. Admin adds a section Class 7-B if missing
3. Admin adds a teacher "E2E Teacher" with subject Math
4. Admin adds a student "E2E Student" with roll 777 in Class 7-B
5. Admin assigns E2E Teacher to Class 7-B for Math
6. Logout
7. Teacher logs in (priya@school.com / 123456 — or the seeded teacher account)
8. Teacher navigates to Upload & Analyze
9. Teacher enters roll 777, selects a test, uploads a small PDF fixture
10. Teacher submits, sees the RCA result
11. Logout
12. Student logs in (aarav.patel@student.com / 123456 — or E2E Student account if auth exists)
13. Student sees the latest score in their dashboard
14. Student clicks the test and sees the report card
```

## Implementation notes
- Place a small PDF fixture at `e2e/fixtures/answer-sheet.pdf` (any 1-page PDF, <100KB).
- Use Playwright's `page.setInputFiles()` to attach the file.
- Use `expect(page.getByText(...))` rather than CSS selectors where possible.
- Wrap each step in `await test.step('description', async () => {...})` for nice reports.

## Data hygiene
- Use unique suffixes in names/emails (`E2E Teacher ${Date.now()}`) to avoid collisions on re-run.
- Add a cleanup step at the start that removes any lingering `E2E *` rows — OR better, use a Supabase service-role cleanup in `playwright.config.js` `globalTeardown`.

## Acceptance criteria
- [ ] `npm run test:e2e` runs the spec green against `localhost:5173` + live Supabase.
- [ ] Failure messages are readable.
- [ ] Runtime < 90 seconds.

## After completion
Commit with: `test(e2e): add full school→teacher→student happy path`
