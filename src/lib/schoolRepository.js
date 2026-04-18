import { emptySchoolData } from './schoolEmptyState.js';

function parseClassName(className) {
  const n = parseInt(String(className), 10);
  return Number.isFinite(n) ? n : 0;
}

function topicsToArray(topics) {
  if (Array.isArray(topics)) return topics;
  if (topics && typeof topics === 'object') return Object.values(topics);
  return [];
}

/**
 * Load full school graph and map to the legacy `data` shape expected by the UI.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ schoolId?: string | null }} [options] When set, restrict teachers/students/scores to that school org.
 */
export async function loadSchoolData(supabase, options = {}) {
  if (!supabase) return { ...emptySchoolData };

  const { schoolId = null } = options;

  const [
    { data: themeRows, error: e1 },
    { data: chapterRows, error: e2 },
  ] = await Promise.all([
    supabase.from('syllabus_themes').select('id, theme_code, title, domain').order('title'),
    supabase.from('syllabus_chapters').select('id, theme_id, chapter_number, title, topics').order('chapter_number'),
  ]);

  let classQuery = supabase.from('classes').select('id, school_id, class_name');
  if (schoolId) classQuery = classQuery.eq('school_id', schoolId);
  const { data: classRows, error: e3 } = await classQuery;

  let tq = supabase
    .from('teachers')
    .select('id, name, email, phone, subject, experience, education, join_date, user_id, school_id');
  if (schoolId) tq = tq.eq('school_id', schoolId);
  const { data: teacherRows, error: e4 } = await tq;

  let sq = supabase.from('students').select(
    'id, name, email, roll_no, class_id, attendance, assigned_teacher_id, parent_name, parent_phone, address, school_id'
  );
  if (schoolId) sq = sq.eq('school_id', schoolId);
  const { data: studentRows, error: e6 } = await sq;

  const studentIds = (studentRows || []).map((s) => s.id);

  // Scores — short-circuit if no students in scope (avoids sentinel UUID and 400s)
  let scoreRows = [];
  let e7 = null;
  if (!schoolId || studentIds.length > 0) {
    // Try with feedback/grade columns first (migration 015).
    // Fall back to basic columns if those don't exist yet (400 / column not found).
    let baseScoreQuery = supabase
      .from('scores')
      .select('id, student_id, test_id, score, topic_scores, feedback, grade, graded_at, updated_at');
    if (schoolId) baseScoreQuery = baseScoreQuery.in('student_id', studentIds);

    const { data: sd1, error: se1 } = await baseScoreQuery;
    if (se1) {
      // Likely missing feedback/grade columns — retry without them
      let fallbackQuery = supabase
        .from('scores')
        .select('id, student_id, test_id, score, topic_scores, graded_at, updated_at');
      if (schoolId) fallbackQuery = fallbackQuery.in('student_id', studentIds);
      const { data: sd2, error: se2 } = await fallbackQuery;
      scoreRows = sd2 || [];
      e7 = se2; // only hard-fail on the fallback error
    } else {
      scoreRows = sd1 || [];
      e7 = null;
    }
  }

  const { data: tcaRows, error: e5 } = await supabase
    .from('teacher_class_assignments')
    .select('id, teacher_id, class_id, subject');

  const teacherIdSet = new Set((teacherRows || []).map((t) => t.id));
  const classIdSet = new Set((classRows || []).map((c) => c.id));
  const tcaFiltered = (tcaRows || []).filter(
    (a) => teacherIdSet.has(a.teacher_id) && classIdSet.has(a.class_id)
  );

  const { data: testRows, error: e8 } = await supabase
    .from('tests')
    .select(
      'id, title, theme_id, chapter_id, domain, topics, duration_minutes, total_marks, test_type, created_by_teacher_id, created_at, updated_at'
    );

  let sstaRows = [];
  let e9 = null;
  if (!(schoolId && studentIds.length === 0)) {
    let sstaQuery = supabase
      .from('student_subject_teacher_assignments')
      .select('id, student_id, teacher_id, subject, created_at');
    if (schoolId && studentIds.length > 0) sstaQuery = sstaQuery.in('student_id', studentIds);
    const { data: sstaData, error: sstaError } = await sstaQuery;
    if (sstaError) {
      // Keep app usable even if this optional mapping table is missing on older schemas.
      e9 = /PGRST205|schema cache|Could not find the table/i.test(String(sstaError.message || sstaError.code || ''))
        ? null
        : sstaError;
      sstaRows = [];
    } else {
      sstaRows = sstaData || [];
    }
  }

  // test_analyses is optional — if the table doesn't exist yet, swallow the error
  const { data: rawAnalysisRows } = await supabase
    .from('test_analyses')
    .select('id, test_id, analysis, created_at, bucket, storage_path, uploaded_by_teacher_id')
    .then(r => r, () => ({ data: null }));
  const analysisRows = rawAnalysisRows || [];

  // Throw only on hard errors (core tables: themes, chapters, classes, teachers, students, TCA, tests)
  const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9;
  if (err) throw err;

  const themeById = Object.fromEntries((themeRows || []).map((t) => [t.id, t]));
  const chapterById = Object.fromEntries((chapterRows || []).map((c) => [c.id, c]));

  const syllabus = {
    ...emptySchoolData.syllabus,
    book: 'Exploring Society: India and Beyond',
    themes: (themeRows || []).map((t) => ({
      theme: t.theme_code,
      title: t.title,
      domain: t.domain,
      chapters: (chapterRows || [])
        .filter((c) => c.theme_id === t.id)
        .sort((a, b) => a.chapter_number - b.chapter_number)
        .map((c) => ({
          chapter_number: c.chapter_number,
          title: c.title,
          topics: topicsToArray(c.topics),
        })),
    })),
  };
  syllabus.total_chapters = (chapterRows || []).length;

  const classById = Object.fromEntries((classRows || []).map((c) => [c.id, c]));

  const teachers = (teacherRows || []).map((t) => {
    const classes = [];
    for (const a of tcaFiltered || []) {
      if (a.teacher_id !== t.id) continue;
      const cl = classById[a.class_id];
      if (!cl) continue;
      classes.push({
        class: parseClassName(cl.class_name),
        subject: a.subject,
      });
    }
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      phone: t.phone || '',
      subject: t.subject || '',
      experience: t.experience ?? '',
      education: t.education || '',
      joinDate: t.join_date || '',
      students: [],
      classes,
    };
  });

  const schoolClasses = (classRows || []).map((c) => {
    const teachersOnClass = (tcaFiltered || [])
      .filter((a) => a.class_id === c.id)
      .map((a) => ({
        teacherId: a.teacher_id,
        subject: a.subject,
      }));
    return {
      id: c.id,
      class: parseClassName(c.class_name),
      className: c.class_name,
      teachers: teachersOnClass,
    };
  });

  const latestAnalysisByTest = {};
  for (const row of analysisRows || []) {
    const prev = latestAnalysisByTest[row.test_id];
    if (!prev || new Date(row.created_at) > new Date(prev.created_at)) {
      latestAnalysisByTest[row.test_id] = row;
    }
  }

  const tests = (testRows || []).map((te) => {
    const ch = te.chapter_id ? chapterById[te.chapter_id] : null;
    const th = te.theme_id ? themeById[te.theme_id] : ch ? themeById[ch.theme_id] : null;
    const chapterNum = ch?.chapter_number ?? 0;
    const topics = topicsToArray(te.topics?.length ? te.topics : ch?.topics);
    const analysisRow = latestAnalysisByTest[te.id];
    return {
      id: te.id,
      title: te.title,
      chapter: chapterNum,
      theme: th?.theme_code || '',
      domain: te.domain || th?.domain || '',
      topics,
      duration: te.duration_minutes ?? 60,
      totalMarks: te.total_marks != null ? Number(te.total_marks) : 100,
      type: te.test_type || 'Chapter Test',
      createdAt: te.created_at,
      created_by_teacher_id: te.created_by_teacher_id,
      analysis: analysisRow?.analysis ?? null,
      uploadedAt: analysisRow?.created_at ?? null,
    };
  });

  const scoresByStudent = {};
  for (const sc of scoreRows || []) {
    if (!scoresByStudent[sc.student_id]) scoresByStudent[sc.student_id] = [];
    scoresByStudent[sc.student_id].push({
      id: sc.id,
      testId: sc.test_id,
      date: sc.graded_at,
      score: Number(sc.score),
      topicScores: sc.topic_scores && typeof sc.topic_scores === 'object' ? sc.topic_scores : {},
      feedback: sc.feedback || null,
      grade: sc.grade || null,
      updatedAt: sc.updated_at,
    });
  }

  const students = (studentRows || []).map((st) => {
    const cl = st.class_id ? classById[st.class_id] : null;
    return {
      id: st.id,
      name: st.name,
      email: st.email,
      class: cl ? parseClassName(cl.class_name) : 6,
      rollNo: st.roll_no != null && st.roll_no !== '' ? parseInt(String(st.roll_no), 10) || 0 : 0,
      assignedTeacher: st.assigned_teacher_id || '',
      parentName: st.parent_name || '',
      parentPhone: st.parent_phone || '',
      address: st.address || '',
      attendance: st.attendance != null ? Number(st.attendance) : 0,
      scores: scoresByStudent[st.id] || [],
    };
  });

  return {
    syllabus,
    teachers,
    students,
    tests,
    schoolClasses,
    studentSubjectAssignments: sstaRows,
    classes: [6, 7, 8, 9, 10],
    subjects: emptySchoolData.subjects,
  };
}

export async function insertSchool(supabase, row) {
  const payload = {
    name: String(row.name || '').trim(),
  };
  if (!payload.name) throw new Error('School name is required.');
  const { data, error } = await supabase.from('schools').insert(payload).select('id, name').single();
  if (error) throw error;
  return data;
}

export async function deleteSchool(supabase, schoolId) {
  const id = String(schoolId || '').trim();
  if (!id) throw new Error('School id is required.');
  const { error } = await supabase.from('schools').delete().eq('id', id);
  if (error) throw error;
}

async function resolveThemeChapterIds(supabase, themeCode, chapterNumber) {
  const { data: theme, error: e1 } = await supabase
    .from('syllabus_themes')
    .select('id')
    .eq('theme_code', themeCode)
    .maybeSingle();
  if (e1) throw e1;
  if (!theme) throw new Error(`Unknown theme code: ${themeCode}`);

  const { data: chapter, error: e2 } = await supabase
    .from('syllabus_chapters')
    .select('id')
    .eq('theme_id', theme.id)
    .eq('chapter_number', chapterNumber)
    .maybeSingle();
  if (e2) throw e2;
  if (!chapter) throw new Error(`Unknown chapter ${chapterNumber} for theme ${themeCode}`);

  return { themeId: theme.id, chapterId: chapter.id };
}

export async function insertTeacher(supabase, row) {
  const payload = {
    name: row.name,
    email: row.email,
    user_id: row.userId ?? row.user_id ?? null,
    phone: row.phone || null,
    subject: row.subject || null,
    experience: row.experience != null && row.experience !== '' ? Number(row.experience) : null,
    education: row.education || null,
    join_date: row.joinDate || null,
    school_id: row.schoolId ?? row.school_id ?? null,
  };
  const { data, error } = await supabase.from('teachers').insert(payload).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteTeacher(supabase, id) {
  const { error } = await supabase.from('teachers').delete().eq('id', id);
  if (error) throw error;
}

export async function insertStudent(supabase, row, classIdMap) {
  const cls = typeof row.class === 'string' ? parseInt(row.class, 10) : row.class;
  const key = String(cls);
  const classId = classIdMap.get(key);
  if (!classId) throw new Error(`Class not found for class ${row.class}. Create the class first.`);

  const payload = {
    name: row.name,
    email: row.email,
    user_id: row.userId ?? row.user_id ?? null,
    roll_no: row.rollNo != null ? String(row.rollNo) : null,
    class_id: classId,
    attendance: row.attendance != null ? row.attendance : null,
    assigned_teacher_id: row.assignedTeacher || null,
    parent_name: row.parentName || null,
    parent_phone: row.parentPhone || null,
    address: row.address || null,
    school_id: row.schoolId ?? row.school_id ?? null,
  };
  const { data, error } = await supabase.from('students').insert(payload).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateStudent(supabase, id, row, classIdMap) {
  const cls = typeof row.class === 'string' ? parseInt(row.class, 10) : row.class;
  const key = String(cls);
  const classId = classIdMap.get(key);
  if (!classId) throw new Error(`Class not found for class ${row.class}. Create the class first.`);

  const payload = {
    name: row.name,
    email: row.email,
    roll_no: row.rollNo != null ? String(row.rollNo) : null,
    class_id: classId,
    attendance: row.attendance != null ? row.attendance : null,
    assigned_teacher_id: row.assignedTeacher || null,
    parent_name: row.parentName || null,
    parent_phone: row.parentPhone || null,
    address: row.address || null,
  };
  const { error } = await supabase.from('students').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteStudent(supabase, id) {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}

export async function insertClass(supabase, { schoolId, className }) {
  const cn = String(className ?? '').trim();
  if (!schoolId || !cn) throw new Error('schoolId and className are required.');
  const { error } = await supabase.from('classes').upsert(
    { school_id: schoolId, class_name: cn },
    { onConflict: 'school_id,class_name' }
  );
  if (error) throw error;
}

export async function updateClass(supabase, { schoolId, classId, className }) {
  const cn = String(className ?? '').trim();
  if (!schoolId || !classId || !cn) throw new Error('schoolId, classId and className are required.');
  const { error } = await supabase
    .from('classes')
    .update({ class_name: cn })
    .eq('id', classId)
    .eq('school_id', schoolId);
  if (error) throw error;
}

export async function deleteClass(supabase, { schoolId, classId }) {
  if (!schoolId || !classId) throw new Error('schoolId and classId are required.');
  const { error } = await supabase.from('classes').delete().eq('id', classId).eq('school_id', schoolId);
  if (error) throw error;
}

export async function insertTeacherClassAssignment(supabase, teacherId, className, subject, classIdMap) {
  const cn = typeof className === 'string' ? parseInt(className, 10) : className;
  const key = String(cn);
  const classId = classIdMap.get(key);
  if (!classId) throw new Error(`Class not found for ${key}`);

  const { error } = await supabase.from('teacher_class_assignments').upsert(
    {
      teacher_id: teacherId,
      class_id: classId,
      subject,
    },
    {
      onConflict: 'teacher_id,class_id,subject',
    }
  );
  if (error) throw error;
}

export async function updateTeacherClassAssignmentTeacher(
  supabase,
  oldTeacherId,
  newTeacherId,
  className,
  subject,
  classIdMap
) {
  const cn = typeof className === 'string' ? parseInt(className, 10) : className;
  const key = String(cn);
  const classId = classIdMap.get(key);
  if (!classId) throw new Error(`Class not found for ${key}`);

  const { data: row, error: e1 } = await supabase
    .from('teacher_class_assignments')
    .select('id')
    .eq('teacher_id', oldTeacherId)
    .eq('class_id', classId)
    .eq('subject', subject)
    .maybeSingle();
  if (e1) throw e1;
  if (!row) throw new Error('Assignment not found');

  const { error: e2 } = await supabase.from('teacher_class_assignments').update({ teacher_id: newTeacherId }).eq('id', row.id);
  if (e2) throw e2;
}

export async function createTestRecord(supabase, testInput, { createdByTeacherId }) {
  const hasTheme =
    testInput.theme != null && String(testInput.theme).trim() !== '';
  const hasChapter =
    testInput.chapter != null && testInput.chapter !== '' && !Number.isNaN(Number(testInput.chapter));

  let themeId = null;
  let chapterId = null;
  if (hasTheme && hasChapter) {
    const resolved = await resolveThemeChapterIds(
      supabase,
      testInput.theme,
      typeof testInput.chapter === 'string' ? parseInt(testInput.chapter, 10) : testInput.chapter
    );
    themeId = resolved.themeId;
    chapterId = resolved.chapterId;
  }

  const schoolId = testInput.schoolId ?? testInput.school_id ?? null;

  const payload = {
    title: testInput.title,
    school_id: schoolId,
    theme_id: themeId,
    chapter_id: chapterId,
    domain: testInput.domain || null,
    topics: testInput.topics || [],
    duration_minutes: testInput.duration || null,
    total_marks: testInput.totalMarks != null ? testInput.totalMarks : 100,
    test_type: testInput.type || 'Chapter Test',
    created_by_teacher_id: createdByTeacherId || null,
  };

  const { data, error } = await supabase.from('tests').insert(payload).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteTest(supabase, id) {
  const { error: resultsErr } = await supabase.from('results').delete().eq('test_id', id);
  if (resultsErr) throw resultsErr;
  const { error } = await supabase.from('tests').delete().eq('id', id);
  if (error) throw error;
}

export async function insertScore(supabase, studentId, testId, scoreData) {
  const payload = {
    student_id: studentId,
    test_id: testId,
    score: scoreData.score,
    topic_scores: scoreData.topicScores || {},
    feedback: scoreData.feedback || null,
    grade: scoreData.grade || null,
    graded_by_teacher_id: scoreData.gradedByTeacherId || null,
  };
  const { error } = await supabase.from('scores').insert(payload);
  if (error) throw error;
}

export async function updateScoreValue(supabase, scoreId, newScore) {
  const { error } = await supabase.from('scores').update({ score: newScore }).eq('id', scoreId);
  if (error) throw error;
}

export async function assignStudentsToTeacher(supabase, studentIds, teacherId) {
  for (const sid of studentIds) {
    const { error } = await supabase.from('students').update({ assigned_teacher_id: teacherId }).eq('id', sid);
    if (error) throw error;
  }
}

export async function upsertStudentSubjectTeacherAssignment(
  supabase,
  { studentId, teacherId, subject }
) {
  if (!studentId || !teacherId || !subject) {
    throw new Error('studentId, teacherId, and subject are required.');
  }
  const { error } = await supabase.from('student_subject_teacher_assignments').upsert(
    {
      student_id: studentId,
      teacher_id: teacherId,
      subject,
    },
    { onConflict: 'student_id,subject' }
  );
  if (error) throw error;
}

export async function insertTestAnalysisRow(supabase, { testId, teacherId, bucket, storagePath, analysis }) {
  const payload = {
    test_id: testId,
    uploaded_by_teacher_id: teacherId,
    bucket: bucket || 'test-analyses',
    storage_path: storagePath || '',
    analysis: analysis || {},
  };
  const { error } = await supabase.from('test_analyses').insert(payload);
  if (error) throw error;
}

/** Build class label (e.g. "6") -> class row id for a school */
export async function fetchClassIdMap(supabase, schoolId) {
  if (!schoolId) throw new Error('schoolId is required.');
  const { data: rows, error } = await supabase.from('classes').select('id, class_name').eq('school_id', schoolId);
  if (error) throw error;
  const map = new Map();
  for (const r of rows || []) {
    map.set(String(parseClassName(r.class_name)), r.id);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save an answer sheet record (file already uploaded to storage).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ testId: string, studentId?: string, rollNo?: string, bucket?: string, storagePath: string, teacherId: string }} row
 * @returns {Promise<string>} inserted row id
 */
export async function insertAnswerSheet(supabase, row) {
  const payload = {
    test_id: row.testId,
    student_id: row.studentId || null,
    roll_no: row.rollNo || null,
    bucket: row.bucket || 'answer-sheets',
    storage_path: row.storagePath || '',
    status: 'uploaded',
    uploaded_by_teacher_id: row.teacherId || null,
  };
  const { data, error } = await supabase
    .from('answer_sheets')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Update the status of an answer sheet (e.g. after evaluation).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id - answer sheet row id
 * @param {'uploaded' | 'processing' | 'evaluated'} status
 */
export async function updateAnswerSheetStatus(supabase, id, status) {
  const { error } = await supabase
    .from('answer_sheets')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Look up a student by roll_no within a section to link an answer sheet.
 * Returns the student id or null.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} rollNo
 * @param {string} classId
 * @returns {Promise<string | null>}
 */
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
 * Fetch all answer sheets for a given test.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} testId
 */
export async function fetchAnswerSheetsByTest(supabase, testId) {
  const { data, error } = await supabase
    .from('answer_sheets')
    .select('id, test_id, student_id, roll_no, bucket, storage_path, status, uploaded_by_teacher_id, created_at')
    .eq('test_id', testId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

/**
 * Fetch all answer sheets uploaded by a teacher.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} teacherId
 */
export async function fetchAnswerSheetsByTeacher(supabase, teacherId) {
  const { data, error } = await supabase
    .from('answer_sheets')
    .select('id, test_id, student_id, roll_no, bucket, storage_path, status, uploaded_by_teacher_id, created_at')
    .eq('uploaded_by_teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluations (extends scores with feedback + grade)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save an evaluation result. Upserts the scores row with score, topic_scores,
 * feedback, and grade.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} studentId
 * @param {string} testId
 * @param {{ score: number, topicScores?: object, feedback?: string, grade?: string, gradedByTeacherId?: string }} evalData
 */
export async function saveEvaluation(supabase, studentId, testId, evalData) {
  const payload = {
    student_id: studentId,
    test_id: testId,
    score: evalData.score,
    topic_scores: evalData.topicScores || {},
    feedback: evalData.feedback || null,
    grade: evalData.grade || null,
  };
  if (evalData.gradedByTeacherId) {
    payload.graded_by_teacher_id = evalData.gradedByTeacherId;
  }
  const { error } = await supabase.from('scores').insert(payload);
  if (error) throw error;
}

/**
 * Fetch evaluations (scores with feedback) for a student.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} studentId
 */
export async function fetchEvaluationsByStudent(supabase, studentId) {
  const { data, error } = await supabase
    .from('scores')
    .select('id, test_id, score, topic_scores, feedback, grade, graded_at, updated_at')
    .eq('student_id', studentId)
    .order('graded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
