import { emptySchoolData } from '../lib/schoolEmptyState.js';

export function parseClassNumber(value) {
  const s = String(value ?? '').trim();
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Maps normalized PostgREST rows (classes.name, results, teacher_classes) to the UI `data` shape.
 */
export function mapSchoolRowsToUiData(raw) {
  if (!raw || typeof raw !== 'object') return { ...emptySchoolData };
  const classes = Array.isArray(raw.classes) ? raw.classes : [];
  const subjects = Array.isArray(raw.subjects) ? raw.subjects : [];
  const teachersRaw = Array.isArray(raw.teachers) ? raw.teachers : [];
  const studentsRaw = Array.isArray(raw.students) ? raw.students : [];
  const testsRaw = Array.isArray(raw.tests) ? raw.tests : [];
  const resultsRaw = Array.isArray(raw.results) ? raw.results : [];
  const teacherClassesRaw = Array.isArray(raw.teacher_classes) ? raw.teacher_classes : [];

  const classById = Object.fromEntries(classes.map((c) => [c.id, c]));
  const subjectById = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
  const testsById = Object.fromEntries(
    testsRaw.map((t) => [
      t.id,
      {
        id: t.id,
        title: t.name,
        type: t.name,
        domain: subjectById[t.subject_id] || '',
        created_by_teacher_id: t.created_by,
        createdAt: t.created_at,
      },
    ])
  );

  const teachers = teachersRaw.map((t) => ({
    id: t.id,
    userId: t.user_id || null,
    name: t.name,
    email: t.email,
    subject: subjectById[t.subject_id] || '',
    schoolId: t.school_id,
    subjectId: t.subject_id,
    classes: [],
  }));
  const teacherById = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const schoolClasses = classes.map((c) => ({
    id: c.id,
    class: parseClassNumber(c.name),
    className: c.name,
    teachers: [],
  }));
  const schoolClassById = Object.fromEntries(schoolClasses.map((c) => [c.id, c]));
  for (const link of teacherClassesRaw) {
    const teacher = teacherById[link.teacher_id];
    const cls = schoolClassById[link.class_id];
    if (!teacher || !cls) continue;
    teacher.classes.push({ class: cls.class, subject: teacher.subject || '' });
    cls.teachers.push({ teacherId: teacher.id, subject: teacher.subject || '' });
  }
  const scoresByStudent = {};
  for (const r of resultsRaw) {
    if (!scoresByStudent[r.student_id]) scoresByStudent[r.student_id] = [];
    scoresByStudent[r.student_id].push({
      id: r.id,
      testId: r.test_id,
      score: Number(r.marks) || 0,
      date: r.created_at || null,
      topicScores: {},
    });
  }
  const students = studentsRaw.map((s) => ({
    id: s.id,
    userId: s.user_id || null,
    name: s.name,
    email: s.email,
    class: parseClassNumber(classById[s.class_id]?.name),
    rollNo: s.roll_no != null ? Number(s.roll_no) || 0 : 0,
    assignedTeacher: '',
    scores: scoresByStudent[s.id] || [],
    schoolId: s.school_id,
    classId: s.class_id,
  }));

  return {
    ...emptySchoolData,
    teachers,
    students,
    tests: Object.values(testsById),
    schoolClasses,
    subjects: subjects.map((s) => s.name).filter(Boolean),
    subjectRows: subjects.map((s) => ({ id: s.id, name: s.name })),
  };
}
