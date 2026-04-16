# Task 3 — Wire teacher upload flow to the real evaluation service

**Model:** Claude Sonnet 4.6
**Expected time:** 45–60 minutes
**Risk:** Medium (touches critical workflow)

## Context
`src/components/teacher/UploadAnalyze.jsx` currently uploads to Supabase Storage, then calls the edge function `analyze_test`. The edge function is a black box we're replacing with the on-the-fly dummy RCA evaluator from Task 2. The upload must resolve the entered roll number → `students.id` before evaluation.

## Goal

### 3.1 Rewrite the submit handler in `UploadAnalyze.jsx`
Replace the existing flow:
```
file → Storage → edge function → setAnalysisResult
```
with:
```
file → Storage → lookup student by rollNo → createAndEvaluate() → setAnalysisResult
```

### 3.2 Student resolution
Before evaluation:
```js
const student = data.students.find(s => String(s.rollNo) === String(rollNo));
if (!student) { setUploadError(`No student found with roll number ${rollNo}`); return; }
```

### 3.3 Call evaluationService
```js
import { createAndEvaluate } from '../../lib/evaluationService';

const { answerSheetId, marks, grade, details, feedback } = await createAndEvaluate({
  testId: selectedTestId,
  studentId: student.id,
  teacherId: currentUser.id,
  storagePath,
  test: data.tests.find(t => t.id === selectedTestId),
  student,
});
```

### 3.4 Update UI
The result block currently shows summary + question analysis + recommendations from the edge-function response. Rewire it to consume the new shape:
- `marks`, `grade` in the gradient header card
- `details.perQuestionScores` → question table
- `details.topicRCA.weak` / `.strong` → colored chips (existing code)
- `details.improvementPlan` → numbered list
- `feedback` → callout box

### 3.5 Refresh school data after upload
After `createAndEvaluate` succeeds, call `refreshData()` from context so the student's scores appear in their dashboard immediately.

## Acceptance criteria
- [ ] Teacher can upload an answer sheet and see detailed RCA within 2 seconds (dummy latency).
- [ ] Error shown if roll number doesn't match any student.
- [ ] Record appears in `answer_sheets` AND `evaluations` tables.
- [ ] Student dashboard shows the new evaluation immediately after teacher submits.
- [ ] No call to `supabase.functions.invoke('analyze_test')` remains in the file.

## After completion
Commit with: `feat(teacher): wire answer-sheet upload to evaluationService with RCA output`
