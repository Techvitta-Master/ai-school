# Task 2 — Upgrade the dummy evaluator to produce detailed RCA

**Model:** Claude Sonnet 4.6
**Expected time:** 60–90 minutes
**Risk:** Medium (affects data shape + DB schema)

## Context
The current `src/lib/evaluationService.js` returns only `{ marks, feedback }` — a trivial placeholder. Per the MVP plan we need **detailed RCA** (per-question scoring + topic-level analysis + improvement plan) so the student report card can render meaningfully.

The real OCR+LLM integration is Phase 2; for MVP the evaluator stays _dummy_ but its output shape must match what a real evaluator would produce, so the frontend and DB are forward-compatible.

## Goal

### 2.1 Extend DB schema
Create `supabase/sql/019_evaluation_details.sql`:
- Add column `details jsonb not null default '{}'::jsonb` to `public.evaluations`.
- Add column `grade text` to `public.evaluations`.
- Leave existing `marks` and `feedback` columns untouched.

### 2.2 Upgrade `src/lib/evaluationService.js`
Rewrite `evaluateAnswerSheet(answerSheetId, { test, student })` to return:

```js
{
  marks: 78,
  grade: 'B+',
  perQuestionScores: [
    { q: 'Q1', topic: 'Photosynthesis', max: 10, scored: 8, remark: 'Good understanding' },
    ...
  ],
  topicRCA: {
    weak: [
      { topic: 'Cellular respiration', score: 45, reason: 'Confused aerobic vs anaerobic' },
    ],
    strong: [
      { topic: 'Plant structure', score: 92, reason: 'Clear diagrams' },
    ],
  },
  improvementPlan: [
    'Revise NCERT chapter 6 pages 112-118',
    'Practice 5 MCQs daily on cellular respiration',
    'Watch recommended video on Krebs cycle',
  ],
  feedback: 'Solid work overall. Focus on respiration pathways next week.',
}
```

Algorithm (dummy but realistic):
- `marks` = random 60–95 (existing)
- `grade` = derived from marks (A+ ≥90, A ≥80, B+ ≥70, B ≥60, C ≥50, D <50)
- `perQuestionScores`: generate 5 questions, draw topics from `test.topics` array (fall back to `['General']`), random marks per question summing close to total
- `topicRCA.weak`: questions where scored/max < 0.6, grouped by topic
- `topicRCA.strong`: questions where scored/max >= 0.8
- `improvementPlan`: 3 templated strings that reference the weak topics by name
- `feedback`: one of ~5 templated strings based on grade band

Write the full object to `evaluations.details` (jsonb). Keep `marks`, `grade`, `feedback` in their own columns.

### 2.3 Update `createAndEvaluate()`
Accept and forward `{ test, student }` to `evaluateAnswerSheet` so the dummy generator can reference real topics.

### 2.4 Add tests
`src/lib/evaluationService.test.js` with Vitest:
- Given test with topics `['A', 'B']`, output contains those topics in `perQuestionScores`.
- Output conforms to the shape above (basic schema check).
- Grade matches marks band.

## Acceptance criteria
- [ ] `019_evaluation_details.sql` migration created and applied.
- [ ] `evaluationService.js` returns the new rich shape.
- [ ] `getStudentEvaluations()` returns the `details` column.
- [ ] Vitest suite passes.
- [ ] `npm run build` succeeds.

## After completion
Commit with: `feat(eval): produce detailed RCA output from dummy evaluator`
