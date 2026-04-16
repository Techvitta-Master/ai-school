# Task 4 — Build teacher's "My Class" landing view

**Model:** Claude Sonnet 4.6
**Expected time:** 45–60 minutes
**Risk:** Low

## Context
Per the workflow ("Teacher Login → mapped Students → per student answersheet upload"), the teacher's first screen should show their assigned class and the students mapped to it, with a fast path to upload an answer sheet for any student.

Today the teacher lands on `TeacherOverview.jsx` which is an analytics screen. We want a simpler workflow-first home.

## Goal

### 4.1 Create `src/components/teacher/MyClass.jsx`
Layout:
- Header: teacher name + assigned subject (from `currentUser.subject`)
- Class selector pills — one pill per `teacher_section_assignments` entry for this teacher (e.g. "Class 8-A · Math", "Class 9-B · Math")
- Selected class panel:
  - Class stats (student count, avg score, last test date)
  - Students table with columns: Roll No, Name, Latest Test, Latest Score, Grade, Action (button "Upload Sheet")
  - Clicking "Upload Sheet" on a row navigates to `/teacher/upload?rollNo=<n>` and pre-fills the roll number.

### 4.2 Update `UploadAnalyze.jsx`
- Read `rollNo` from URL search params on mount via `useSearchParams()` from `react-router-dom`.
- Pre-populate the rollNo input.
- If a pre-fill comes in, auto-scroll focus to the file dropzone.

### 4.3 Update `TeacherDashboard.jsx` routing
- New default route at `/teacher` renders `MyClass`
- Keep `TeacherOverview` available at `/teacher/analytics`
- Update sidebar nav in `Layout.jsx` accordingly:
  - "My Class" (default)
  - "Upload & Analyze"
  - (hide ConductTest, CompareClasses for MVP — gate behind `VITE_ENABLE_ADVANCED_TEACHER_TOOLS`)

## Acceptance criteria
- [ ] Teacher login lands on `/teacher` showing "My Class" with their mapped students.
- [ ] Clicking "Upload Sheet" takes them to the upload screen with roll number pre-filled.
- [ ] Empty state ("No class assigned yet. Contact school admin.") if teacher has zero assignments.
- [ ] Works for a teacher with multiple sections (e.g. Math teacher in 8-A and 9-B).

## After completion
Commit with: `feat(teacher): add workflow-first MyClass landing view with per-student upload shortcut`
