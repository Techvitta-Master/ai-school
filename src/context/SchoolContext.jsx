/* eslint react-refresh/only-export-components: off */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { emptySchoolData } from '../lib/schoolEmptyState';
import { resolveCurrentUser } from '../lib/resolveCurrentUser';
import * as repo from '../lib/schoolRepository';
import { useApiLayer } from '../lib/apiConfig';
import * as schoolApi from '../lib/schoolApi';

const SchoolContext = createContext();
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || '123456';
const DEMO_USER_STORAGE_KEY = 'demoCurrentUser';
const DEMO_SCHOOL_ID = 'd0000000-0000-4000-8000-000000000001'; // Madavi Institute (018_madavi_seed.sql)
const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const DEMO_USERS = {
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_ADMIN || 'admin@school.com')]: {
    role: 'admin', id: 'admin', name: 'School Admin', isDemo: true,
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_SCHOOL || 'school@school.com')]: {
    role: 'school', id: 'school-demo', name: 'Madavi School Admin',
    schoolId: DEMO_SCHOOL_ID, schoolName: 'Madavi Institute', isDemo: true,
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_TEACHER || 'priya@school.com')]: {
    role: 'teacher', id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    name: 'Priya Sharma', subject: 'Social Science', schoolId: DEMO_SCHOOL_ID, isDemo: true,
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_STUDENT || 'aarav.patel@student.com')]: {
    role: 'student', id: 'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    name: 'Aarav Patel', schoolId: DEMO_SCHOOL_ID, isDemo: true,
  },
};

/** When API user payload lacks `role`, align with known demo accounts (same emails as Login). */
function inferPortalRoleFromEmail(email) {
  return DEMO_USERS[normalizeEmail(email)]?.role ?? null;
}

/** Last resort when /me + DB resolution fail but JWT session is valid (keeps /school from bouncing to /login). */
function buildMinimalUserFromSession(user) {
  if (!user?.email) return null;
  const n = normalizeEmail(user.email);
  const demo = DEMO_USERS[n];
  if (!demo) return null;
  const role = demo.role;
  const authUserId = user.id;

  if (role === 'admin') {
    return { role: 'admin', id: 'admin', name: user.user_metadata?.full_name || demo.name, authUserId };
  }
  if (role === 'school') {
    return {
      role: 'school',
      id: user.id,
      authUserId,
      name: user.user_metadata?.full_name || demo.name,
      schoolId: DEMO_SCHOOL_ID,
      schoolName: 'Madavi Institute',
    };
  }
  if (role === 'teacher') {
    return {
      role: 'teacher',
      id: demo.id,
      authUserId,
      name: demo.name,
      subject: demo.subject,
      schoolId: DEMO_SCHOOL_ID,
    };
  }
  if (role === 'student') {
    return {
      role: 'student',
      id: demo.id,
      authUserId,
      name: demo.name,
      schoolId: DEMO_SCHOOL_ID,
    };
  }
  return null;
}

const getStoredDemoUser = () => {
  try {
    const raw = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const storeDemoUser = (user) => {
  try {
    window.localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage failures (private mode / quota issues).
  }
};

const clearStoredDemoUser = () => {
  try {
    window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) throw new Error('useSchool must be used within SchoolProvider');
  return context;
};

/**
 * Students visible to a teacher: subject-teacher mappings (SSTA), explicit `assigned_teacher_id`,
 * or any class where the teacher has a TCA row (same model as My Class).
 */
function collectStudentIdsForTeacher(d, teacherId) {
  if (!teacherId || !d?.students?.length) return new Set();
  const ids = new Set();
  for (const m of d.studentSubjectAssignments ?? []) {
    if (m.teacher_id === teacherId) ids.add(m.student_id);
  }
  const tr = d.teachers.find((t) => t.id === teacherId);
  const classNums = new Set((tr?.classes ?? []).map((c) => c.class));
  for (const s of d.students) {
    if (s.assignedTeacher === teacherId) ids.add(s.id);
    if (classNums.has(s.class)) ids.add(s.id);
  }
  return ids;
}

export const SchoolProvider = ({ children }) => {
  const [data, setData] = useState(emptySchoolData);
  const dataRef = useRef(data);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data: s } = await supabase.auth.getSession();
    return s?.session?.access_token ?? null;
  }, []);

  const refreshData = useCallback(async () => {
    if (!supabase || currentUser?.isDemo) return;
    const schoolId = currentUser?.role === 'school' ? currentUser.schoolId : null;
    if (useApiLayer()) {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) return;
      const next = await schoolApi.loadSchoolData(token, { schoolId });
      setData(next);
      return;
    }
    const next = await repo.loadSchoolData(supabase, { schoolId });
    setData(next);
  }, [currentUser]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setAuthLoading(true);
      setAuthError(null);

      if (!supabase) {
        setAuthError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        setCurrentUser(null);
        setAuthLoading(false);
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionError) {
          setAuthError(sessionError.message);
          setCurrentUser(null);
          return;
        }

        const user = sessionData?.session?.user ?? null;
        if (!user) {
          setCurrentUser(null);
          return;
        }
        let resolved = null;
        try {
          if (useApiLayer()) {
            const token = sessionData?.session?.access_token;
            if (!token) {
              setAuthError('No access token in session.');
            } else {
              try {
                resolved = await schoolApi.fetchMe(token);
              } catch {
                resolved = await resolveCurrentUser(supabase, user);
              }
            }
          } else {
            resolved = await resolveCurrentUser(supabase, user);
          }
        } catch (err) {
          setAuthError(err?.message || 'Failed to resolve user.');
        }
        if (!resolved && user) {
          try {
            resolved = await resolveCurrentUser(supabase, user);
          } catch {
            // leave resolved null
          }
        }
        if (!resolved && user) {
          resolved = buildMinimalUserFromSession(user);
        }
        if (!isMounted) return;
        setCurrentUser(resolved);
      } catch (err) {
        if (isMounted) {
          setAuthError(err?.message || 'Auth initialization failed.');
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    init();

    if (!supabase) return () => {};

    // Only react to real sign-out. Re-fetching /me here races with login()'s setSession and was
    // clearing or overwriting currentUser right after a successful password login.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      let user = session?.user ?? null;
      if (!user) {
        const { data: fresh } = await supabase.auth.getSession();
        user = fresh?.session?.user ?? null;
      }
      if (!user) {
        clearStoredDemoUser();
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!supabase) {
        setDataLoading(false);
        return;
      }

      if (authLoading) return;

      if (!currentUser) {
        setData({ ...emptySchoolData });
        setDataLoading(false);
        return;
      }

      // Demo users have no real Supabase session — skip all API calls
      if (currentUser.isDemo) {
        setData({ ...emptySchoolData });
        setDataLoading(false);
        return;
      }

      if (currentUser.role === 'school' && !currentUser.schoolId) {
        setData({ ...emptySchoolData });
        setDataLoading(false);
        setAuthError('Your account is not linked to a school. Contact support.');
        return;
      }

      setDataLoading(true);
      try {
        const schoolId = currentUser.role === 'school' ? currentUser.schoolId : null;
        let remote;
        if (useApiLayer()) {
          const { data: s } = await supabase.auth.getSession();
          const token = s?.session?.access_token;
          if (!token) throw new Error('No access token.');
          remote = await schoolApi.loadSchoolData(token, { schoolId });
        } else {
          remote = await repo.loadSchoolData(supabase, { schoolId });
        }
        if (!cancelled) {
          setData(remote);
          setAuthError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError(err?.message || 'Failed to load school data from Supabase.');
          setData({ ...emptySchoolData });
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser]);

  const login = async (email, password) => {
    setAuthError(null);
    clearStoredDemoUser();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!supabase) {
      setAuthError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return { success: false, role: null };
    }

    // Single strict login path: frontend -> backend /api/auth/login.
    // No fallback when API fails; user must stay logged out.
    try {
      const auth = await schoolApi.loginApi(normalizedEmail, password);
      await supabase.auth.setSession({
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
      });
      const { data: verify } = await supabase.auth.getSession();
      if (!verify?.session?.user) {
        throw new Error('Session was not saved. Allow site storage / disable strict blocking.');
      }
      // Use `user` from login response (server already runs resolveCurrentUser).
      let nextUser = auth.user ? { ...auth.user } : null;
      if (!nextUser?.role) {
        const inferred = inferPortalRoleFromEmail(normalizedEmail);
        if (inferred) {
          nextUser = { ...(nextUser || {}), role: inferred };
        }
      }
      if (!nextUser?.role) {
        nextUser = buildMinimalUserFromSession(verify.session.user);
      }
      if (!nextUser?.role) {
        throw new Error('Could not resolve your role after login.');
      }
      nextUser = { ...nextUser, authUserId: verify.session.user.id };
      clearStoredDemoUser();
      setCurrentUser(nextUser);
      return { success: true, role: String(nextUser.role).toLowerCase(), error: null };
    } catch (err) {
      const msg = err?.message || 'Login failed.';
      setAuthError(msg);
      setCurrentUser(null);
      return { success: false, role: null, error: msg };
    }
  };

  const logout = async () => {
    setAuthError(null);
    clearStoredDemoUser();
    // Make logout instant in UI even if network sign-out is slow/fails.
    setCurrentUser(null);
    setData({ ...emptySchoolData });
    setDataLoading(false);
    try {
      // Local scope avoids blocking on global logout endpoint.
      await supabase?.auth.signOut({ scope: 'local' });
    } catch {
      // Session state is already cleared locally; ignore remote sign-out failures.
    }
  };

  /**
   * Pre-flight check: ensure a real Supabase Auth session exists before any mutation.
   * Returns an error string if no valid JWT is present, otherwise null.
   * Prevents mysterious 401 responses from PostgREST when the session silently expired
   * or the user is in demo mode but somehow reached an action path.
   */
  const ensureRealSession = async () => {
    if (!supabase) return 'Supabase is not configured.';
    if (currentUser?.isDemo) return 'Demo mode — connect a real Supabase account to save data.';
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return `Session error: ${error.message}`;
      if (!data?.session?.access_token) {
        return 'Your session has expired. Please log out and sign in again with a real account.';
      }
    } catch (err) {
      return err?.message || 'Could not verify session.';
    }
    return null;
  };

  const addTeacher = async (teacher) => {
    const sessionErr = await ensureRealSession();
    if (sessionErr) return { error: sessionErr };
    try {
      const payload = { ...teacher };
      if (currentUser?.role === 'school' && currentUser.schoolId) {
        payload.schoolId = currentUser.schoolId;
      }
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.insertTeacherApi(token, payload);
      } else {
        await repo.insertTeacher(supabase, payload);
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to add teacher.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const removeTeacher = async (id) => {
    const sessionErr = await ensureRealSession();
    if (sessionErr) return { error: sessionErr };
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.deleteTeacherApi(token, id);
      } else {
        await repo.deleteTeacher(supabase, id);
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to remove teacher.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const addStudent = async (student) => {
    const sessionErr = await ensureRealSession();
    if (sessionErr) return { error: sessionErr };
    try {
      const payload = { ...student };
      if (currentUser?.role === 'school' && currentUser.schoolId) {
        payload.schoolId = currentUser.schoolId;
      }
      if (currentUser?.role === 'admin' && student.schoolId) {
        payload.schoolId = student.schoolId;
      }
      const schoolIdForClass = payload.schoolId || currentUser?.schoolId;
      try {
        if (useApiLayer()) {
          const t = await getAccessToken();
          if (!t) return { error: 'Your session has expired. Please sign in again.' };
          if (schoolIdForClass) {
            await schoolApi.insertClassApi(t, schoolIdForClass, String(student.class));
          }
        } else if (schoolIdForClass) {
          await repo.insertClass(supabase, { schoolId: schoolIdForClass, className: String(student.class) });
        }
      } catch (classErr) {
        console.warn('Class upsert skipped (may already exist):', classErr?.message);
      }
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.insertStudentApi(token, payload);
      } else {
        const sid = payload.schoolId;
        const classIdMap = await repo.fetchClassIdMap(supabase, sid);
        await repo.insertStudent(supabase, payload, classIdMap);
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to add student.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const updateStudent = async (id, student) => {
    const sessionErr = await ensureRealSession();
    if (sessionErr) return { error: sessionErr };
    try {
      const payload = { ...student };
      if (currentUser?.role === 'school' && currentUser.schoolId) {
        payload.schoolId = currentUser.schoolId;
      }
      if (currentUser?.role === 'admin' && student.schoolId) {
        payload.schoolId = student.schoolId;
      }
      const schoolIdForClass = payload.schoolId || currentUser?.schoolId;
      try {
        if (useApiLayer()) {
          const t = await getAccessToken();
          if (!t) return { error: 'Your session has expired. Please sign in again.' };
          if (schoolIdForClass) {
            await schoolApi.insertClassApi(t, schoolIdForClass, String(student.class));
          }
        } else if (schoolIdForClass) {
          await repo.insertClass(supabase, { schoolId: schoolIdForClass, className: String(student.class) });
        }
      } catch (classErr) {
        console.warn('Class upsert skipped (may already exist):', classErr?.message);
      }
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.updateStudentApi(token, id, payload);
      } else {
        const sid = payload.schoolId;
        const classIdMap = await repo.fetchClassIdMap(supabase, sid);
        await repo.updateStudent(supabase, id, payload, classIdMap);
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to update student.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const removeStudent = async (id) => {
    const sessionErr = await ensureRealSession();
    if (sessionErr) return { error: sessionErr };
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.deleteStudentApi(token, id);
      } else {
        await repo.deleteStudent(supabase, id);
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to remove student.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const assignTeacherToClass = async (teacherId, className, subject) => {
    if (!supabase || currentUser?.isDemo) return;
    const schoolId = currentUser?.schoolId;
    if (!schoolId) {
      setAuthError('Your account is not linked to a school.');
      return;
    }
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.insertTeacherClassAssignmentApi(token, teacherId, className, subject, schoolId);
      } else {
        const classIdMap = await repo.fetchClassIdMap(supabase, schoolId);
        await repo.insertTeacherClassAssignment(supabase, teacherId, className, subject, classIdMap);
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to assign teacher.');
    }
  };

  const changeTeacherClass = async (oldTeacherId, newTeacherId, className, subject) => {
    if (!supabase || currentUser?.isDemo) return;
    const schoolId = currentUser?.schoolId;
    if (!schoolId) return;
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.updateTeacherClassAssignmentTeacherApi(
          token,
          oldTeacherId,
          newTeacherId,
          className,
          subject,
          schoolId
        );
      } else {
        const classIdMap = await repo.fetchClassIdMap(supabase, schoolId);
        await repo.updateTeacherClassAssignmentTeacher(
          supabase,
          oldTeacherId,
          newTeacherId,
          className,
          subject,
          classIdMap
        );
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to update assignment.');
    }
  };

  const createTest = async (test) => {
    if (!supabase || currentUser?.isDemo) {
      return { error: currentUser?.isDemo ? 'Demo mode cannot create tests.' : 'Supabase is not configured.' };
    }
    const createdBy =
      currentUser?.role === 'teacher' ? currentUser.id : null;
    const testPayload = {
      ...test,
      schoolId: currentUser?.schoolId ?? test.schoolId,
    };
    try {
      let newId = null;
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        const res = await schoolApi.createTestRecordApi(token, testPayload, createdBy);
        newId = res?.id ?? null;
      } else {
        newId = await repo.createTestRecord(supabase, testPayload, { createdByTeacherId: createdBy });
      }
      await refreshData();
      return { error: null, id: newId };
    } catch (err) {
      const msg = err?.message || 'Failed to create test.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const removeTest = async (id) => {
    if (!supabase || currentUser?.isDemo) return;
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.deleteTestApi(token, id);
      } else {
        await repo.deleteTest(supabase, id);
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to remove test.');
    }
  };

  const addScore = async (studentId, testId, scoreData) => {
    const test = dataRef.current.tests.find((t) => t.id === testId);
    if (!test) return;
    if (!supabase || currentUser?.isDemo) return;
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.insertScoreApi(token, studentId, testId, scoreData);
      } else {
        await repo.insertScore(supabase, studentId, testId, scoreData);
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to add score.');
    }
  };

  const updateScore = async (studentId, scoreId, newScore) => {
    if (!supabase || currentUser?.isDemo) return;
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.updateScoreValueApi(token, scoreId, newScore);
      } else {
        await repo.updateScoreValue(supabase, scoreId, newScore);
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to update score.');
    }
  };

  const uploadTestAnalysis = async (testId, payload) => {
    if (!supabase || currentUser?.isDemo || currentUser?.role !== 'teacher') return;
    const analysis = payload?.analysis ?? payload;
    const bucket = payload?.bucket ?? import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? 'test-analyses';
    const storagePath = payload?.storagePath ?? '';
    try {
      const row = {
        testId,
        teacherId: currentUser.id,
        bucket,
        storagePath,
        analysis,
      };
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.insertTestAnalysisRowApi(token, row);
      } else {
        await repo.insertTestAnalysisRow(supabase, row);
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to save test analysis.');
    }
  };

  /**
   * Save an answer sheet record after the file has been uploaded to storage.
   * Optionally resolves the studentId from rollNo + classId.
   * @param {{ testId: string, studentId?: string, rollNo?: string, classId?: string, storagePath: string, bucket?: string }} payload
   */
  const saveAnswerSheet = async (payload) => {
    if (!supabase || currentUser?.isDemo || currentUser?.role !== 'teacher') return null;
    try {
      let studentId = payload.studentId || null;
      if (!studentId && payload.rollNo && payload.classId) {
        if (useApiLayer()) {
          const token = await getAccessToken();
          if (!token) return null;
          studentId = await schoolApi.findStudentIdByRollNoApi(token, payload.rollNo, payload.classId);
        } else {
          studentId = await repo.findStudentIdByRollNo(supabase, payload.rollNo, payload.classId);
        }
      }
      const row = {
        testId: payload.testId,
        studentId,
        rollNo: payload.rollNo || null,
        bucket: payload.bucket || 'answer-sheets',
        storagePath: payload.storagePath || '',
        teacherId: currentUser.id,
      };
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return null;
        return await schoolApi.insertAnswerSheetApi(token, row);
      }
      return await repo.insertAnswerSheet(supabase, row);
    } catch (err) {
      setAuthError(err?.message || 'Failed to save answer sheet.');
      return null;
    }
  };

  /**
   * Fetch answer sheets for a test (teacher-side view).
   * @param {string} testId
   */
  const getAnswerSheetsByTest = async (testId) => {
    if (!supabase || currentUser?.isDemo) return [];
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return [];
        return await schoolApi.fetchAnswerSheetsByTestApi(token, testId);
      }
      return await repo.fetchAnswerSheetsByTest(supabase, testId);
    } catch (err) {
      setAuthError(err?.message || 'Failed to fetch answer sheets.');
      return [];
    }
  };

  /**
   * Save a full evaluation (score + topic scores + feedback + grade).
   * Upserts the scores row and optionally marks the answer sheet as evaluated.
   * @param {string} studentId
   * @param {string} testId
   * @param {{ score: number, topicScores?: object, feedback?: string, grade?: string, answerSheetId?: string }} evalData
   */
  const saveEvaluation = async (studentId, testId, evalData) => {
    if (!supabase || currentUser?.isDemo) return;
    try {
      const teacherId = currentUser?.role === 'teacher' ? currentUser.id : null;
      const payload = {
        ...evalData,
        gradedByTeacherId: teacherId,
      };
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.saveEvaluationApi(token, studentId, testId, payload);
        if (evalData.answerSheetId) {
          await schoolApi.updateAnswerSheetStatusApi(token, evalData.answerSheetId, 'evaluated');
        }
      } else {
        await repo.saveEvaluation(supabase, studentId, testId, payload);
        if (evalData.answerSheetId) {
          await repo.updateAnswerSheetStatus(supabase, evalData.answerSheetId, 'evaluated');
        }
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to save evaluation.');
    }
  };

  const getStudentPerformance = useCallback((studentId) => {
    const student = data.students.find((s) => s.id === studentId);
    if (!student) return null;

    const overallScore =
      student.scores.length > 0
        ? student.scores.reduce((acc, sc) => acc + sc.score, 0) / student.scores.length
        : 0;

    const subjectWise = {};
    const topicWise = {};
    const testWise = {};

    student.scores.forEach((sc) => {
      const test = data.tests.find((t) => t.id === sc.testId);
      if (test) {
        const theme = data.syllabus.themes.find((t) =>
          t.chapters.some((c) => c.chapter_number === test.chapter)
        );
        const subject = test.domain || theme?.domain || 'General';

        if (!subjectWise[subject]) subjectWise[subject] = { total: 0, count: 0 };
        subjectWise[subject].total += sc.score;
        subjectWise[subject].count++;

        const topicList = test.topics?.length ? test.topics : ['Overall'];
        const n = Math.max(topicList.length, 1);
        topicList.forEach((topic) => {
          if (!topicWise[topic]) topicWise[topic] = { total: 0, count: 0 };
          const part = sc.topicScores?.[topic];
          topicWise[topic].total += part != null ? part : sc.score / n;
          topicWise[topic].count++;
        });

        testWise[test.title] = sc.score;
      }
    });

    Object.keys(subjectWise).forEach((sub) => {
      subjectWise[sub] = subjectWise[sub].total / subjectWise[sub].count;
    });
    Object.keys(topicWise).forEach((top) => {
      topicWise[top] = topicWise[top].total / topicWise[top].count;
    });

    const weakTopics = Object.entries(topicWise)
      .filter(([, score]) => score < 50)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5);

    const strongTopics = Object.entries(topicWise)
      .filter(([, score]) => score >= 70)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { overallScore, subjectWise, topicWise, testWise, weakTopics, strongTopics };
  }, [data]);

  const getTeacherPerformance = useCallback(
    (teacherId) => {
      const rosterIds = collectStudentIdsForTeacher(data, teacherId);
      const assignedStudents = data.students.filter((s) => rosterIds.has(s.id));

      if (assignedStudents.length === 0) {
        return { totalStudents: 0, avgPerformance: 0, classPerformance: {}, studentDetails: [] };
      }

      const studentDetails = assignedStudents.map((s) => {
        const perf = getStudentPerformance(s.id);
        return { ...s, performance: perf };
      });

      const totalAvg =
        studentDetails.reduce((acc, s) => acc + (s.performance?.overallScore || 0), 0) /
        studentDetails.length;

      const classPerformance = {};
      studentDetails.forEach((s) => {
        const key = String(s.class);
        if (!classPerformance[key]) classPerformance[key] = { total: 0, count: 0 };
        classPerformance[key].total += s.performance?.overallScore || 0;
        classPerformance[key].count++;
      });

      Object.keys(classPerformance).forEach((key) => {
        classPerformance[key] = classPerformance[key].total / classPerformance[key].count;
      });

      return {
        totalStudents: assignedStudents.length,
        avgPerformance: totalAvg,
        classPerformance,
        studentDetails,
      };
    },
    [data, getStudentPerformance]
  );

  const getTeacherAssignedStudents = useCallback((teacherId) => {
    const rosterIds = collectStudentIdsForTeacher(data, teacherId);
    return data.students.filter((s) => rosterIds.has(s.id));
  }, [data]);

  const assignStudentsToTeacher = async (studentIds, teacherId) => {
    if (!supabase) return;
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.assignStudentsToTeacherApi(token, studentIds, teacherId);
      } else {
        await repo.assignStudentsToTeacher(supabase, studentIds, teacherId);
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to assign students.');
    }
  };

  const assignStudentToTeacherBySubject = async (studentId, teacherId, subject) => {
    if (!supabase) return { error: 'Supabase is not configured.' };
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.upsertStudentSubjectTeacherAssignmentApi(token, studentId, teacherId, subject);
      } else {
        await repo.upsertStudentSubjectTeacherAssignment(supabase, { studentId, teacherId, subject });
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to save subject mapping.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const createSchool = async (name, schoolAdminEmail, schoolAdminName) => {
    if (!supabase) return { error: 'Supabase is not configured.', school: null };
    if (currentUser?.role !== 'admin') return { error: 'Only admins can create schools.', school: null };
    const trimmed = (name || '').trim();
    if (!trimmed) return { error: 'School name is required.', school: null };
    try {
      let school = null;
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.', school: null };
        school = await schoolApi.createSchoolApi(token, trimmed, schoolAdminEmail, schoolAdminName);
      } else {
        school = await repo.insertSchool(supabase, { name: trimmed });
      }
      await refreshData();
      return { error: null, school };
    } catch (err) {
      const msg = err?.message || 'Failed to create school.';
      setAuthError(msg);
      return { error: msg, school: null };
    }
  };

  const deleteSchool = async (schoolId) => {
    if (!supabase) return { error: 'Supabase is not configured.' };
    if (currentUser?.role !== 'admin') return { error: 'Only admins can delete schools.' };
    const id = String(schoolId || '').trim();
    if (!id) return { error: 'School id is required.' };
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.deleteSchoolApi(token, id);
      } else {
        await repo.deleteSchool(supabase, id);
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to delete school.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const getClassStudents = (classNum) => {
    return data.students.filter((s) => s.class === classNum);
  };

  const getSchoolClasses = () => {
    return data.schoolClasses ?? [];
  };

  const addClass = async (className) => {
    if (!supabase || !currentUser?.schoolId) return;
    try {
      if (useApiLayer()) {
        const token = await getAccessToken();
        if (!token) return;
        await schoolApi.insertClassApi(token, currentUser.schoolId, String(className));
      } else {
        await repo.insertClass(supabase, { schoolId: currentUser.schoolId, className: String(className) });
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to add class.');
    }
  };

  return (
    <SchoolContext.Provider
      value={{
        data,
        currentUser,
        login,
        logout,
        authLoading,
        authError,
        dataLoading,
        addTeacher,
        removeTeacher,
        addStudent,
        updateStudent,
        removeStudent,
        assignTeacherToClass,
        changeTeacherClass,
        createTest,
        removeTest,
        addScore,
        updateScore,
        uploadTestAnalysis,
        refreshData,
        saveAnswerSheet,
        getAnswerSheetsByTest,
        saveEvaluation,
        getStudentPerformance,
        getTeacherPerformance,
        getTeacherAssignedStudents,
        assignStudentsToTeacher,
        assignStudentToTeacherBySubject,
        getClassStudents,
        getSchoolClasses,
        addClass,
        createSchool,
        deleteSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};
