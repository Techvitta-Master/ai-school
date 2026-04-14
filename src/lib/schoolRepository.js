import { emptySchoolData } from './schoolEmptyState';

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
    { data: sectionRows, error: e3 },
  ] = await Promise.all([
    supabase.from('syllabus_themes').select('id, theme_code, title, domain').order('title'),
    supabase.from('syllabus_chapters').select('id, theme_id, chapter_number, title, topics').order('chapter_number'),
    supabase.from('sections').select('id, class_name, section_name, strength, class_teacher_id'),
  ]);

  let tq = supabase
    .from('teachers')
    .select('id, name, email, phone, subject, experience, education, join_date, user_id, school_id');
  if (schoolId) tq = tq.eq('school_id', schoolId);
  const { data: teacherRows, error: e4 } = await tq;

  let sq = supabase.from('students').select(
    'id, name, email, roll_no, section_id, attendance, assigned_teacher_id, parent_name, parent_phone, address, school_id'
  );
  if (schoolId) sq = sq.eq('school_id', schoolId);
  const { data: studentRows, error: e6 } = await sq;

  const studentIds = (studentRows || []).map((s) => s.id);
  let scoreQuery = supabase.from('scores').select('id, student_id, test_id, score, topic_scores, graded_at, updated_at');
  if (schoolId) {
    if (studentIds.length === 0) {
      scoreQuery = scoreQuery.eq('student_id', '00000000-0000-0000-0000-000000000000');
    } else {
      scoreQuery = scoreQuery.in('student_id', studentIds);
    }
  }
  const { data: scoreRows, error: e7 } = await scoreQuery;

  const { data: tsaRows, error: e5 } = await supabase
    .from('teacher_section_assignments')
    .select('id, teacher_id, section_id, subject');

  const teacherIdSet = new Set((teacherRows || []).map((t) => t.id));
  const tsaFiltered = schoolId ? (tsaRows || []).filter((a) => teacherIdSet.has(a.teacher_id)) : tsaRows || [];

  const [{ data: testRows, error: e8 }, { data: analysisRows, error: e9 }] = await Promise.all([
    supabase
      .from('tests')
      .select(
        'id, title, theme_id, chapter_id, domain, topics, duration_minutes, total_marks, test_type, created_by_teacher_id, created_at, updated_at'
      ),
    supabase.from('test_analyses').select('id, test_id, analysis, created_at, bucket, storage_path, uploaded_by_teacher_id'),
  ]);

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

  const sectionById = Object.fromEntries((sectionRows || []).map((s) => [s.id, s]));

  const teachers = (teacherRows || []).map((t) => {
    const classes = [];
    for (const a of tsaFiltered || []) {
      if (a.teacher_id !== t.id) continue;
      const sec = sectionById[a.section_id];
      if (!sec) continue;
      classes.push({
        class: parseClassName(sec.class_name),
        section: sec.section_name,
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

  const sections = (sectionRows || []).map((s) => {
    const teachersOnSection = (tsaFiltered || [])
      .filter((a) => a.section_id === s.id)
      .map((a) => ({
        teacherId: a.teacher_id,
        subject: a.subject,
      }));
    return {
      class: parseClassName(s.class_name),
      section: s.section_name,
      strength: s.strength ?? 0,
      classTeacher: s.class_teacher_id || '',
      teachers: teachersOnSection,
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
      updatedAt: sc.updated_at,
    });
  }

  const students = (studentRows || []).map((st) => {
    const sec = st.section_id ? sectionById[st.section_id] : null;
    return {
      id: st.id,
      name: st.name,
      email: st.email,
      class: sec ? parseClassName(sec.class_name) : 6,
      section: sec ? sec.section_name : 'A',
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
    sections,
    classes: [6, 7, 8],
    subjects: emptySchoolData.subjects,
  };
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

export async function insertStudent(supabase, row, sectionIdMap) {
  const cls = typeof row.class === 'string' ? parseInt(row.class, 10) : row.class;
  const key = `${cls}-${row.section}`;
  const sectionId = sectionIdMap.get(key);
  if (!sectionId) throw new Error(`Section not found for class ${row.class} section ${row.section}`);

  const payload = {
    name: row.name,
    email: row.email,
    roll_no: row.rollNo != null ? String(row.rollNo) : null,
    section_id: sectionId,
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

export async function deleteStudent(supabase, id) {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}

export async function insertSection(supabase, className, sectionName) {
  const payload = {
    class_name: String(className),
    section_name: sectionName,
  };
  const { error } = await supabase.from('sections').upsert(payload, {
    onConflict: 'class_name,section_name',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function insertTeacherSectionAssignment(supabase, teacherId, className, sectionName, subject, sectionIdMap) {
  const cn = typeof className === 'string' ? parseInt(className, 10) : className;
  const key = `${cn}-${sectionName}`;
  const sectionId = sectionIdMap.get(key);
  if (!sectionId) throw new Error(`Section not found for ${key}`);

  const { error } = await supabase.from('teacher_section_assignments').upsert(
    {
      teacher_id: teacherId,
      section_id: sectionId,
      subject,
    },
    {
      onConflict: 'teacher_id,section_id,subject',
      ignoreDuplicates: true,
    }
  );
  if (error) throw error;
}

export async function updateTeacherSectionAssignmentTeacher(
  supabase,
  oldTeacherId,
  newTeacherId,
  className,
  sectionName,
  subject,
  sectionIdMap
) {
  const cn = typeof className === 'string' ? parseInt(className, 10) : className;
  const key = `${cn}-${sectionName}`;
  const sectionId = sectionIdMap.get(key);
  if (!sectionId) throw new Error(`Section not found for ${key}`);

  const { data: row, error: e1 } = await supabase
    .from('teacher_section_assignments')
    .select('id')
    .eq('teacher_id', oldTeacherId)
    .eq('section_id', sectionId)
    .eq('subject', subject)
    .maybeSingle();
  if (e1) throw e1;
  if (!row) throw new Error('Assignment not found');

  const { error: e2 } = await supabase.from('teacher_section_assignments').update({ teacher_id: newTeacherId }).eq('id', row.id);
  if (e2) throw e2;
}

export async function createTestRecord(supabase, testInput, { createdByTeacherId }) {
  const { themeId, chapterId } = await resolveThemeChapterIds(
    supabase,
    testInput.theme,
    testInput.chapter
  );

  const payload = {
    title: testInput.title,
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
  const { error } = await supabase.from('tests').delete().eq('id', id);
  if (error) throw error;
}

export async function insertScore(supabase, studentId, testId, scoreData) {
  const payload = {
    student_id: studentId,
    test_id: testId,
    score: scoreData.score,
    topic_scores: scoreData.topicScores || {},
  };
  const { error } = await supabase.from('scores').upsert(payload, {
    onConflict: 'student_id,test_id',
  });
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

/** Build section key -> id map from loaded sections list + DB ids */
export async function fetchSectionIdMap(supabase) {
  const { data: rows, error } = await supabase.from('sections').select('id, class_name, section_name');
  if (error) throw error;
  const map = new Map();
  for (const r of rows || []) {
    map.set(`${parseClassName(r.class_name)}-${r.section_name}`, r.id);
  }
  return map;
}
