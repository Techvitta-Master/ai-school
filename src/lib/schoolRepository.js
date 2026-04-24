/**
 * Data access for the normalized schema (`027` + `results` + `teacher_classes`).
 * Prefer importing from `@/services/*` in new code; this module keeps stable names for the UI layer.
 */
export { loadSchoolData, listSchools } from '../services/schoolService.js';
export {
  fetchClassIdMap,
  insertClass,
  updateClass,
  deleteClass,
  insertSubject,
  insertTeacherClassAssignment,
  updateTeacherClassAssignmentTeacher,
  createTestRecord,
  deleteTest,
  upsertResult,
  updateResultMarks,
  findStudentIdByRollNo,
  deleteSchool,
  assignSchoolPortalOwner,
} from '../services/schoolService.js';

import * as teacherService from '../services/teacherService.js';
import * as studentService from '../services/studentService.js';
import * as aiEvaluationService from '../services/aiEvaluationService.js';
import {
  upsertResult,
  updateResultMarks,
  updateStudentRow,
  createSchoolWithAdmin,
  insertSchoolRecord,
} from '../services/schoolService.js';

export async function insertSchool(supabase, row) {
  const email = String(row.schoolAdminEmail || '').trim();
  if (email) {
    return createSchoolWithAdmin(supabase, {
      name: row.name,
      schoolAdminEmail: email,
      schoolAdminName: row.schoolAdminName,
    });
  }
  return insertSchoolRecord(supabase, row);
}

export async function insertTeacher(supabase, row) {
  return teacherService.createTeacher(supabase, row);
}

export async function deleteTeacher(supabase, id) {
  return teacherService.deleteTeacher(supabase, id);
}

export async function insertStudent(supabase, row, classIdMap) {
  const cls = typeof row.class === 'string' ? parseInt(row.class, 10) : row.class;
  const key = String(cls);
  const classId = row.classId || row.class_id || classIdMap.get(key);
  if (!classId) throw new Error(`Class not found for class ${row.class}. Create the class first.`);
  const payload = {
    ...row,
    classId,
    schoolId: row.schoolId ?? row.school_id,
  };
  return studentService.createStudent(supabase, { row: payload });
}

export async function updateStudent(supabase, id, row, classIdMap) {
  return updateStudentRow(supabase, id, row, classIdMap);
}

export async function deleteStudent(supabase, id) {
  return studentService.deleteStudent(supabase, id);
}

export async function insertScore(supabase, studentId, testId, scoreData) {
  return upsertResult(supabase, studentId, testId, scoreData);
}

export async function updateScoreValue(supabase, scoreId, newScore) {
  return updateResultMarks(supabase, scoreId, { newScore, percentage: undefined });
}

/** Legacy: no `assigned_teacher_id` in normalized schema — no-op. */
export async function assignStudentsToTeacher(supabase, studentIds, teacherId) {
  void supabase;
  void studentIds;
  void teacherId;
}

/** Legacy: SSTA table removed — no-op. */
export async function upsertStudentSubjectTeacherAssignment(supabase, params) {
  void supabase;
  void params;
}

/** Optional table — ignore if missing. */
export async function insertTestAnalysisRow(supabase, { testId, teacherId, bucket, storagePath, analysis }) {
  if (!supabase) return;
  const payload = {
    test_id: testId,
    uploaded_by_teacher_id: teacherId,
    bucket: bucket || 'test-analyses',
    storage_path: storagePath || '',
    analysis: analysis || {},
  };
  const { error } = await supabase.from('test_analyses').insert(payload);
  if (error && !/PGRST205|Could not find the table/i.test(String(error.message || ''))) throw error;
}

export async function insertAnswerSheet(supabase, row) {
  void supabase;
  void row;
  return null;
}

export async function updateAnswerSheetStatus(supabase, id, status) {
  void supabase;
  void id;
  void status;
}

export async function fetchAnswerSheetsByTest(supabase, testId) {
  void supabase;
  void testId;
  return [];
}

export async function fetchAnswerSheetsByTeacher(supabase, teacherId) {
  void supabase;
  void teacherId;
  return [];
}

export async function createAnswerSubmission(supabase, payload) {
  return aiEvaluationService.createAnswerSubmission(supabase, payload);
}

export async function createGradingJob(supabase, payload) {
  return aiEvaluationService.createGradingJob(supabase, payload);
}

export async function getGradingJobById(supabase, jobId) {
  return aiEvaluationService.getGradingJobById(supabase, jobId);
}

export async function listGradingJobsByTeacher(supabase, teacherId, options) {
  return aiEvaluationService.listGradingJobsByTeacher(supabase, teacherId, options);
}

export async function listQuestionScoresForResult(supabase, resultId) {
  return aiEvaluationService.listQuestionScoresForResult(supabase, resultId);
}

export async function getImprovementPlanForResult(supabase, resultId) {
  return aiEvaluationService.getImprovementPlanForResult(supabase, resultId);
}

export async function invokeAIEvaluationJob(supabase, jobId) {
  return aiEvaluationService.invokeAIEvaluationJob(supabase, jobId);
}

/**
 * Persist evaluation into `results` (marks + optional percentage); maps legacy `score` field.
 */
export async function saveEvaluation(supabase, studentId, testId, evalData) {
  const marks = Number(evalData.score ?? evalData.marks);
  if (!Number.isFinite(marks)) throw new Error('score is required.');
  return upsertResult(supabase, studentId, testId, {
    marks,
    percentage: evalData.percentage,
  });
}

export async function fetchEvaluationsByStudent(supabase, studentId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('results')
    .select('id, test_id, marks, percentage, created_at, tests(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    test_id: r.test_id,
    score: Number(r.marks) || 0,
    graded_at: r.created_at,
    tests: r.tests,
  }));
}
