import { mapSchoolRowsToUiData, parseClassNumber } from './schoolDataMapper.js';
import { emptySchoolData } from '../lib/schoolEmptyState.js';

/**
 * Parallel bulk fetch (replaces POST /api/school-data).
 */
export async function loadSchoolData(supabase, { schoolId = null } = {}) {
  if (!supabase) {
    return { ...emptySchoolData };
  }

  const classQ = supabase.from('classes').select('id, school_id, name').order('name');
  const subjectQ = supabase.from('subjects').select('id, school_id, name').order('name');
  const teacherQ = supabase.from('teachers').select('id, school_id, subject_id, user_id, name, email');
  const studentQ = supabase.from('students').select('id, school_id, class_id, user_id, name, email, roll_no');
  const testQ = supabase.from('tests').select('id, name, subject_id, class_id, created_by, created_at');
  const resultQ = supabase.from('results').select('id, student_id, test_id, marks, percentage, created_at');
  const tcQ = supabase.from('teacher_classes').select('id, teacher_id, class_id, created_at');

  const [
    { data: classes, error: cErr },
    { data: subjects, error: subErr },
    { data: teachers, error: tErr },
    { data: students, error: stErr },
    { data: tests, error: teErr },
    { data: results, error: rErr },
    { data: teacher_classes, error: tcErr },
  ] = await Promise.all([
    schoolId ? classQ.eq('school_id', schoolId) : classQ,
    schoolId ? subjectQ.eq('school_id', schoolId) : subjectQ,
    schoolId ? teacherQ.eq('school_id', schoolId) : teacherQ,
    schoolId ? studentQ.eq('school_id', schoolId) : studentQ,
    testQ,
    resultQ,
    tcQ,
  ]);

  const err = cErr || subErr || tErr || stErr || teErr || rErr || tcErr;
  if (err) throw err;

  return mapSchoolRowsToUiData({
    classes: classes || [],
    subjects: subjects || [],
    teachers: teachers || [],
    students: students || [],
    tests: tests || [],
    results: results || [],
    teacher_classes: teacher_classes || [],
  });
}

export async function listSchools(supabase) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('schools')
    .select('id,name,created_at,created_by')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function fetchClassIdMap(supabase, schoolId) {
  if (!schoolId) throw new Error('schoolId is required.');
  const { data: rows, error } = await supabase.from('classes').select('id, name').eq('school_id', schoolId);
  if (error) throw error;
  const map = new Map();
  for (const r of rows || []) {
    map.set(String(parseClassNumber(r.name)), r.id);
  }
  return map;
}

export async function insertClass(supabase, { schoolId, className }) {
  const cn = String(className ?? '').trim();
  if (!schoolId || !cn) throw new Error('schoolId and className are required.');
  const { error } = await supabase
    .from('classes')
    .upsert({ school_id: schoolId, name: cn }, { onConflict: 'school_id,name' });
  if (error) throw error;
}

export async function updateClass(supabase, { schoolId, classId, className }) {
  const cn = String(className ?? '').trim();
  if (!schoolId || !classId || !cn) throw new Error('schoolId, classId and className are required.');
  const { error } = await supabase
    .from('classes')
    .update({ name: cn })
    .eq('id', classId)
    .eq('school_id', schoolId);
  if (error) throw error;
}

export async function deleteClass(supabase, { schoolId, classId }) {
  if (!schoolId || !classId) throw new Error('schoolId and classId are required.');
  const { error } = await supabase.from('classes').delete().eq('id', classId).eq('school_id', schoolId);
  if (error) throw error;
}

export async function insertSubject(supabase, schoolId, name) {
  const n = String(name || '').trim();
  if (!schoolId || !n) throw new Error('schoolId and name are required.');
  const { error } = await supabase
    .from('subjects')
    .upsert({ school_id: schoolId, name: n }, { onConflict: 'school_id,name' });
  if (error) throw error;
}

async function findClassRowByInput(supabase, schoolId, classInput) {
  const raw = String(classInput || '').trim();
  const classNum = parseClassNumber(raw);
  const { data: list, error } = await supabase.from('classes').select('id, school_id, name').eq('school_id', schoolId);
  if (error) throw error;
  let row = (list || []).find((r) => String(r.name).trim().toLowerCase() === raw.toLowerCase());
  if (row) return row;
  if (Number.isFinite(classNum)) {
    row = (list || []).find((r) => parseClassNumber(r.name) === classNum);
    if (row) return row;
  }
  return null;
}

export async function insertTeacherClassAssignment(supabase, teacherId, className, subject, schoolId) {
  const { data: teacher, error: tErr } = await supabase
    .from('teachers')
    .select('id, school_id, subject_id')
    .eq('id', teacherId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!teacher) throw new Error('Teacher not found in this school.');

  const classRow = await findClassRowByInput(supabase, schoolId, className);
  if (!classRow) throw new Error('Class not found.');

  const { data: subjectRow, error: sErr } = await supabase
    .from('subjects')
    .select('id, school_id, name')
    .eq('school_id', schoolId)
    .eq('name', String(subject).trim())
    .maybeSingle();
  if (sErr) throw sErr;
  if (!subjectRow) throw new Error('Subject not found.');

  if (teacher.subject_id !== subjectRow.id) {
    throw new Error('Teacher can only be assigned to their own subject.');
  }

  const { error: linkErr } = await supabase
    .from('teacher_classes')
    .upsert({ teacher_id: teacher.id, class_id: classRow.id }, { onConflict: 'teacher_id,class_id' });
  if (linkErr) throw linkErr;
}

export async function updateTeacherClassAssignmentTeacher(
  supabase,
  oldTeacherId,
  newTeacherId,
  className,
  subject,
  schoolId
) {
  const classRow = await findClassRowByInput(supabase, schoolId, className);
  if (!classRow) throw new Error('Class not found.');

  const { data: subjectRow, error: sErr } = await supabase
    .from('subjects')
    .select('id')
    .eq('school_id', schoolId)
    .eq('name', String(subject).trim())
    .maybeSingle();
  if (sErr) throw sErr;
  if (!subjectRow) throw new Error('Subject not found.');

  const { data: oldTeacher, error: oldErr } = await supabase
    .from('teachers')
    .select('id, subject_id')
    .eq('id', oldTeacherId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (oldErr) throw oldErr;
  if (!oldTeacher || oldTeacher.subject_id !== subjectRow.id) {
    throw new Error('Old teacher assignment not valid for this subject.');
  }

  const { data: newTeacher, error: newErr } = await supabase
    .from('teachers')
    .select('id, subject_id')
    .eq('id', newTeacherId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (newErr) throw newErr;
  if (!newTeacher || newTeacher.subject_id !== subjectRow.id) {
    throw new Error('New teacher must have the same subject.');
  }

  const { error: delErr } = await supabase
    .from('teacher_classes')
    .delete()
    .eq('teacher_id', oldTeacherId)
    .eq('class_id', classRow.id);
  if (delErr) throw delErr;

  const { error: linkErr } = await supabase
    .from('teacher_classes')
    .upsert({ teacher_id: newTeacherId, class_id: classRow.id }, { onConflict: 'teacher_id,class_id' });
  if (linkErr) throw linkErr;
}

export async function createTestRecord(supabase, testInput, { createdByTeacherId }) {
  const testName = String(testInput?.name || testInput?.title || '').trim();
  const classId = testInput?.classId || testInput?.class_id;
  let subjectId = testInput?.subjectId || testInput?.subject_id || null;
  if (!testName || !classId || !createdByTeacherId) {
    throw new Error('name, classId and createdByTeacherId are required.');
  }

  const { data: teacher, error: teacherErr } = await supabase
    .from('teachers')
    .select('id, subject_id')
    .eq('id', createdByTeacherId)
    .maybeSingle();
  if (teacherErr) throw teacherErr;
  if (!teacher) throw new Error('Teacher not found.');

  if (!subjectId) subjectId = teacher.subject_id;
  if (teacher.subject_id !== subjectId) {
    throw new Error('Teacher can only create tests for their subject.');
  }

  const { data, error } = await supabase
    .from('tests')
    .insert({
      name: testName,
      subject_id: subjectId,
      class_id: classId,
      created_by: createdByTeacherId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteTest(supabase, id) {
  const { error: resultsErr } = await supabase.from('results').delete().eq('test_id', id);
  if (resultsErr) throw resultsErr;
  const { error } = await supabase.from('tests').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertResult(supabase, studentId, testId, scoreData) {
  const marks = Number(scoreData?.marks ?? scoreData?.score);
  if (!Number.isFinite(marks)) throw new Error('marks must be numeric.');
  const percentage =
    scoreData?.percentage != null && scoreData?.percentage !== '' ? Number(scoreData.percentage) : null;

  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('id, class_id')
    .eq('id', studentId)
    .maybeSingle();
  if (studentErr) throw studentErr;
  if (!student) throw new Error('Student not found.');

  const { data: test, error: testErr } = await supabase.from('tests').select('id, class_id').eq('id', testId).maybeSingle();
  if (testErr) throw testErr;
  if (!test) throw new Error('Test not found.');
  if (student.class_id !== test.class_id) {
    throw new Error('Student does not belong to the test class.');
  }

  const { error } = await supabase.from('results').upsert(
    {
      student_id: studentId,
      test_id: testId,
      marks,
      percentage,
    },
    { onConflict: 'student_id,test_id' }
  );
  if (error) throw error;
}

export async function updateResultMarks(supabase, resultId, { newScore, percentage }) {
  const payload = {};
  if (newScore != null) payload.marks = Number(newScore);
  if (percentage != null) payload.percentage = Number(percentage);
  if (!Object.keys(payload).length) throw new Error('newScore or percentage is required.');
  const { error } = await supabase.from('results').update(payload).eq('id', resultId);
  if (error) throw error;
}

export async function findStudentIdByRollNo(supabase, rollNo, classId) {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('roll_no', String(rollNo))
    .eq('class_id', classId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * Admin: insert school row only (no school-admin Auth user).
 */
export async function insertSchoolRecord(supabase, row) {
  const name = String(row.name || '').trim();
  if (!name) throw new Error('School name is required.');
  const { data, error } = await supabase.from('schools').insert({ name }).select('id, name').single();
  if (error) throw error;
  return data;
}

/**
 * Admin: school + optional school admin Auth user (Edge Function).
 */
export async function createSchoolWithAdmin(supabase, { name, schoolAdminEmail, schoolAdminName }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('School name is required.');
  const email = String(schoolAdminEmail || '').trim().toLowerCase();
  if (!email) {
    return insertSchoolRecord(supabase, { name: trimmed });
  }
  const { data, error } = await supabase.functions.invoke('create-school', {
    body: {
      name: trimmed,
      schoolAdminEmail: email,
      schoolAdminName: String(schoolAdminName || '').trim() || `${trimmed} Admin`,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.school;
}

export async function deleteSchool(supabase, schoolId) {
  const id = String(schoolId || '').trim();
  if (!id) throw new Error('School id is required.');
  const { error } = await supabase.from('schools').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Admin: set schools.created_by so the school portal user passes RLS (is_school_admin).
 * Target user must exist in public.users with role school (same email as Auth after sync).
 */
export async function assignSchoolPortalOwner(supabase, { schoolId, schoolAdminEmail }) {
  const sid = String(schoolId || '').trim();
  const email = String(schoolAdminEmail || '').trim().toLowerCase();
  if (!sid || !email) throw new Error('School id and school admin email are required.');
  const { data: row, error: uErr } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();
  if (uErr) throw uErr;
  if (!row?.id) {
    throw new Error(
      'No profile for that email in public.users. Create the Auth user, run select sync_public_users_from_auth(), then try again.'
    );
  }
  if (String(row.role || '').toLowerCase() !== 'school') {
    throw new Error('That user must have role "school" in public.users (not teacher/student).');
  }
  const { error } = await supabase.from('schools').update({ created_by: row.id }).eq('id', sid);
  if (error) throw error;
}

export async function updateStudentRow(supabase, id, row, classIdMap) {
  const cls = typeof row.class === 'string' ? parseInt(row.class, 10) : row.class;
  const key = String(cls);
  const classId = row.classId || row.class_id || classIdMap.get(key);
  if (!classId) throw new Error(`Class not found for class ${row.class}. Create the class first.`);

  const schoolId = row.schoolId || row.school_id;
  if (!schoolId) throw new Error('schoolId is required.');

  const payload = {
    name: row.name,
    email: row.email,
    class_id: classId,
    school_id: schoolId,
    roll_no: row.rollNo != null ? String(row.rollNo) : null,
  };
  const { error } = await supabase.from('students').update(payload).eq('id', id);
  if (error) throw error;
}
