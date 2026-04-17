import { getApiBaseUrl } from './apiConfig.js';

async function readError(res) {
  try {
    const j = await res.json();
    return j?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function apiFetch(path, { accessToken, method = 'GET', body, headers = {} } = {}) {
  const base = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const h = { ...headers };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined && !(body instanceof FormData)) {
    h['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers: h,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error((await readError(res)) || `Request failed (${res.status})`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export async function fetchMe(accessToken) {
  return apiFetch('/me', { accessToken });
}

export async function loginApi(email, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function fetchSchoolsList() {
  return apiFetch('/schools', {});
}

export async function createSchoolApi(accessToken, name, schoolAdminEmail, schoolAdminName) {
  return apiFetch('/schools', {
    accessToken,
    method: 'POST',
    body: { name, schoolAdminEmail, schoolAdminName },
  });
}

export async function deleteSchoolApi(accessToken, schoolId) {
  return apiFetch(`/schools/${encodeURIComponent(schoolId)}`, {
    accessToken,
    method: 'DELETE',
  });
}

export async function loadSchoolData(accessToken, { schoolId } = {}) {
  return apiFetch('/school-data', { accessToken, method: 'POST', body: { schoolId: schoolId ?? null } });
}

export async function insertTeacherApi(accessToken, row) {
  return apiFetch('/teachers', { accessToken, method: 'POST', body: row });
}

export async function deleteTeacherApi(accessToken, id) {
  return apiFetch(`/teachers/${id}`, { accessToken, method: 'DELETE' });
}

export async function insertStudentApi(accessToken, row) {
  return apiFetch('/students', { accessToken, method: 'POST', body: { row } });
}

export async function updateStudentApi(accessToken, id, row) {
  return apiFetch(`/students/${encodeURIComponent(id)}`, { accessToken, method: 'PATCH', body: { row } });
}

export async function deleteStudentApi(accessToken, id) {
  return apiFetch(`/students/${id}`, { accessToken, method: 'DELETE' });
}

export async function insertClassApi(accessToken, schoolId, className) {
  return apiFetch('/classes', { accessToken, method: 'POST', body: { schoolId, className } });
}

export async function fetchClassIdMapApi(accessToken, schoolId) {
  const obj = await apiFetch(`/class-id-map?schoolId=${encodeURIComponent(schoolId)}`, { accessToken });
  return new Map(Object.entries(obj || {}));
}

export async function insertTeacherClassAssignmentApi(
  accessToken,
  teacherId,
  className,
  subject,
  schoolId
) {
  return apiFetch('/teacher-class-assignments', {
    accessToken,
    method: 'POST',
    body: { teacherId, className, subject, schoolId },
  });
}

export async function updateTeacherClassAssignmentTeacherApi(
  accessToken,
  oldTeacherId,
  newTeacherId,
  className,
  subject,
  schoolId
) {
  return apiFetch('/teacher-class-assignments', {
    accessToken,
    method: 'PATCH',
    body: { oldTeacherId, newTeacherId, className, subject, schoolId },
  });
}

export async function createTestRecordApi(accessToken, testInput, createdByTeacherId) {
  return apiFetch('/tests', {
    accessToken,
    method: 'POST',
    body: { testInput, createdByTeacherId },
  });
}

export async function deleteTestApi(accessToken, id) {
  return apiFetch(`/tests/${id}`, { accessToken, method: 'DELETE' });
}

export async function insertScoreApi(accessToken, studentId, testId, scoreData) {
  return apiFetch('/scores', {
    accessToken,
    method: 'POST',
    body: { studentId, testId, scoreData },
  });
}

export async function updateScoreValueApi(accessToken, scoreId, newScore) {
  return apiFetch(`/scores/${scoreId}`, {
    accessToken,
    method: 'PATCH',
    body: { newScore },
  });
}

export async function assignStudentsToTeacherApi(accessToken, studentIds, teacherId) {
  return apiFetch('/students/assign-teacher', {
    accessToken,
    method: 'POST',
    body: { studentIds, teacherId },
  });
}

export async function upsertStudentSubjectTeacherAssignmentApi(accessToken, studentId, teacherId, subject) {
  return apiFetch('/student-subject-assignments', {
    accessToken,
    method: 'POST',
    body: { studentId, teacherId, subject },
  });
}

export async function insertTestAnalysisRowApi(accessToken, payload) {
  return apiFetch('/test-analyses', { accessToken, method: 'POST', body: payload });
}

export async function findStudentIdByRollNoApi(accessToken, rollNo, classId) {
  const { studentId } = await apiFetch('/students/find-by-roll', {
    accessToken,
    method: 'POST',
    body: { rollNo, classId },
  });
  return studentId;
}

export async function insertAnswerSheetApi(accessToken, row) {
  const { id } = await apiFetch('/answer-sheets', { accessToken, method: 'POST', body: row });
  return id;
}

export async function fetchAnswerSheetsByTestApi(accessToken, testId) {
  return apiFetch(`/answer-sheets/by-test/${testId}`, { accessToken });
}

export async function saveEvaluationApi(accessToken, studentId, testId, evalData) {
  return apiFetch('/evaluations', {
    accessToken,
    method: 'POST',
    body: { studentId, testId, evalData },
  });
}

export async function updateAnswerSheetStatusApi(accessToken, id, status) {
  return apiFetch(`/answer-sheets/${id}/status`, {
    accessToken,
    method: 'PATCH',
    body: { status },
  });
}

/**
 * Multipart upload + dummy evaluation on the server.
 * @param {string} accessToken
 * @param {FormData} formData — must include `file`, `testId`, `studentId`, `rollNo`; optional `testJson`
 */
export async function uploadAndEvaluateApi(accessToken, formData) {
  return apiFetch('/evaluate/upload-and-evaluate', {
    accessToken,
    method: 'POST',
    body: formData,
  });
}
