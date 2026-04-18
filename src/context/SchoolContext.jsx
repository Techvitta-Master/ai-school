/* eslint react-refresh/only-export-components: off */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { emptySchoolData } from '../lib/schoolEmptyState';
import { resolveCurrentUser } from '../lib/resolveCurrentUser';
import * as repo from '../lib/schoolRepository';
import { isApiLayerEnabled } from '../lib/apiConfig';
import * as schoolApi from '../lib/schoolApi';

const SchoolContext = createContext();
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || '123456';
const DEMO_USER_STORAGE_KEY = 'demoCurrentUser';
const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const DEMO_USERS = {
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_ADMIN || 'admin@school.com')]: {
    role: 'admin', id: 'admin', name: 'School Admin', isDemo: true,
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_SCHOOL || 'school@school.com')]: {
    role: 'school', id: 'school-demo', name: 'Madavi School Admin',
    schoolId: null, schoolName: '', isDemo: true,
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_TEACHER || 'priya@school.com')]: {
    role: 'teacher', id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    name: 'Priya Sharma', subject: 'Social Science', schoolId: null, isDemo: true,
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_STUDENT || 'aarav.patel@student.com')]: {
    role: 'student', id: 'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    name: 'Aarav Patel', schoolId: null, isDemo: true,
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
      schoolId: null,
      schoolName: '',
    };
  }
  if (role === 'teacher') {
    return {
      role: 'teacher',
      id: user.id,
      authUserId,
      email: user.email || '',
      name: user.user_metadata?.full_name || demo.name,
      subject: user.user_metadata?.subject || demo.subject,
      schoolId: null,
    };
  }
  if (role === 'student') {
    return {
      role: 'student',
      id: user.id,
      authUserId,
      email: user.email || '',
      name: user.user_metadata?.full_name || demo.name,
      schoolId: null,
    };
  }
  return null;
}

function parseClassNumber(value) {
  const s = String(value ?? '').trim();
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function mapApiSchoolData(raw) {
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
    name: s.name,
    email: s.email,
    class: parseClassNumber(classById[s.class_id]?.name),
    rollNo: s.roll_no != null ? Number(s.roll_no) || 0 : 0,
    assignedTeacher: '',
    scores: scoresByStudent[s.id] || [],
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

function normalizeSubject(value) {
  return String(value || '').trim().toLowerCase();
}

function upsertTeacherClassAssignmentInData(prev, { teacherId, className, subject }) {
  const next = { ...(prev || emptySchoolData) };
  const normSubject = String(subject || '').trim();
  const classNum = parseClassNumber(className);
  const classKey = String(classNum);

  next.teachers = [...(next.teachers || [])].map((t) => {
    if (t.id !== teacherId) return t;
    const classes = [...(t.classes || [])];
    const exists = classes.some(
      (c) => String(c.class) === classKey && normalizeSubject(c.subject) === normalizeSubject(normSubject)
    );
    if (!exists) classes.push({ class: classNum, subject: normSubject });
    return { ...t, classes };
  });

  next.schoolClasses = [...(next.schoolClasses || [])].map((c) => {
    if (String(c.class) !== classKey) return c;
    const teachers = [...(c.teachers || [])];
    const idx = teachers.findIndex((x) => normalizeSubject(x.subject) === normalizeSubject(normSubject));
    if (idx >= 0) {
      teachers[idx] = { ...teachers[idx], teacherId };
    } else {
      teachers.push({ teacherId, subject: normSubject });
    }
    return { ...c, teachers };
  });

  return next;
}

export const SchoolProvider = ({ children }) => {
  const [data, setData] = useState(emptySchoolData);
  const dataRef = useRef(data);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const loginInProgressRef = useRef(false);

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
    if (isApiLayerEnabled()) {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) return;
      const next = await schoolApi.loadSchoolData(token, { schoolId });
      setData(mapApiSchoolData(next));
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
          if (isApiLayerEnabled()) {
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
        if (resolved && user) {
          resolved = {
            ...resolved,
            authUserId: resolved.authUserId || user.id,
            email: resolved.email || user.email || '',
          };
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
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // During login transition, ignore stale SIGNED_OUT emissions from a prior logout.
      if (loginInProgressRef.current && event === 'SIGNED_OUT') return;

      if (event === 'SIGNED_OUT' || !session?.user) {
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

      setDataLoading(true);
      try {
        const schoolId = currentUser.role === 'school' ? currentUser.schoolId : null;
        let remote;
        if (isApiLayerEnabled()) {
          const { data: s } = await supabase.auth.getSession();
          const token = s?.session?.access_token;
          if (!token) throw new Error('No access token.');
          const remoteRaw = await schoolApi.loadSchoolData(token, { schoolId });
          remote = mapApiSchoolData(remoteRaw);
          // Auto-heal teacher/student identity when fallback login created auth-id-based user object.
          if (currentUser.role === 'teacher') {
            const byTeacherId = (remoteRaw?.teachers || []).find((t) => t.id === currentUser.id);
            const byAuthUserId = (remoteRaw?.teachers || []).find((t) => t.user_id === currentUser.authUserId);
            const byEmail = (remoteRaw?.teachers || []).find(
              (t) => normalizeEmail(t.email) === normalizeEmail(currentUser.email)
            );
            const t = byTeacherId || byAuthUserId || byEmail || null;
            if (t && t.id !== currentUser.id) {
              const subjectName =
                (remoteRaw?.subjects || []).find((s2) => s2.id === t.subject_id)?.name || currentUser.subject || '';
              setCurrentUser((prev) =>
                prev
                  ? {
                      ...prev,
                      id: t.id,
                      schoolId: t.school_id || prev.schoolId || null,
                      subject: subjectName,
                      email: prev.email || t.email || '',
                    }
                  : prev
              );
            }
          }
          if (currentUser.role === 'student') {
            const byStudentId = (remoteRaw?.students || []).find((st) => st.id === currentUser.id);
            const byAuthUserId = (remoteRaw?.students || []).find((st) => st.user_id === currentUser.authUserId);
            const byEmail = (remoteRaw?.students || []).find(
              (st) => normalizeEmail(st.email) === normalizeEmail(currentUser.email)
            );
            const st = byStudentId || byAuthUserId || byEmail || null;
            if (st && st.id !== currentUser.id) {
              setCurrentUser((prev) =>
                prev
                  ? {
                      ...prev,
                      id: st.id,
                      schoolId: st.school_id || prev.schoolId || null,
                      classId: st.class_id || prev.classId || null,
                      email: prev.email || st.email || '',
                    }
                  : prev
              );
            }
          }
          if (!currentUser.schoolId && currentUser.role === 'school') {
            const inferredSchoolId =
              remoteRaw?.classes?.[0]?.school_id ||
              remoteRaw?.teachers?.[0]?.school_id ||
              remoteRaw?.students?.[0]?.school_id ||
              null;
            if (inferredSchoolId) {
              setCurrentUser((prev) => (prev ? { ...prev, schoolId: inferredSchoolId } : prev));
            }
          }
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
    loginInProgressRef.current = true;
    setAuthLoading(true);
    setAuthError(null);
    clearStoredDemoUser();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!supabase) {
      setAuthError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      setAuthLoading(false);
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
      nextUser = {
        ...nextUser,
        authUserId: verify.session.user.id,
        email: nextUser.email || verify.session.user.email || normalizedEmail,
      };
      clearStoredDemoUser();
      setCurrentUser(nextUser);
      return { success: true, role: String(nextUser.role).toLowerCase(), error: null };
    } catch (err) {
      const msg = err?.message || 'Login failed.';
      setAuthError(msg);
      setCurrentUser(null);
      return { success: false, role: null, error: msg };
    } finally {
      loginInProgressRef.current = false;
      setAuthLoading(false);
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
      if (payload.subjectId == null && payload.subject) {
        const match = (dataRef.current.subjectRows || []).find((s) => s.name === payload.subject);
        if (match?.id) payload.subjectId = match.id;
      }
      if (currentUser?.role === 'school' && currentUser.schoolId) {
        payload.schoolId = currentUser.schoolId;
      }
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
      const resolveClassIdFromInput = async () => {
        if (payload.classId) return payload.classId;
        if (payload.class_id) return payload.class_id;
        const raw = String(payload.className ?? payload.class ?? '').trim();
        if (!raw) return null;
        const inputNum = parseClassNumber(raw);
        const localMatch = (dataRef.current.schoolClasses || []).find((c) => {
          const byId = raw === c.id;
          const byName = String(c.className || '').trim().toLowerCase() === raw.toLowerCase();
          const byNum = inputNum > 0 && Number(c.class) === inputNum;
          return byId || byName || byNum;
        });
        if (localMatch?.id) return localMatch.id;
        if (isApiLayerEnabled() && schoolIdForClass) {
          const token = await getAccessToken();
          if (!token) return null;
          const classIdMap = await schoolApi.fetchClassIdMapApi(token, schoolIdForClass);
          const entries = Array.from(classIdMap.entries());
          const mapMatch = entries.find(([name]) => {
            const byName = String(name || '').trim().toLowerCase() === raw.toLowerCase();
            const byNum = inputNum > 0 && parseClassNumber(name) === inputNum;
            return byName || byNum;
          });
          if (mapMatch?.[1]) return mapMatch[1];
        }
        return null;
      };
      try {
        if (isApiLayerEnabled()) {
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
      payload.classId = await resolveClassIdFromInput();
      if (!payload.classId) {
        return { error: 'Class could not be resolved. Please select a valid class.' };
      }
      if (isApiLayerEnabled()) {
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
      const resolveClassIdFromInput = async () => {
        if (payload.classId) return payload.classId;
        if (payload.class_id) return payload.class_id;
        const raw = String(payload.className ?? payload.class ?? '').trim();
        if (!raw) return null;
        const inputNum = parseClassNumber(raw);
        const localMatch = (dataRef.current.schoolClasses || []).find((c) => {
          const byId = raw === c.id;
          const byName = String(c.className || '').trim().toLowerCase() === raw.toLowerCase();
          const byNum = inputNum > 0 && Number(c.class) === inputNum;
          return byId || byName || byNum;
        });
        if (localMatch?.id) return localMatch.id;
        if (isApiLayerEnabled() && schoolIdForClass) {
          const token = await getAccessToken();
          if (!token) return null;
          const classIdMap = await schoolApi.fetchClassIdMapApi(token, schoolIdForClass);
          const entries = Array.from(classIdMap.entries());
          const mapMatch = entries.find(([name]) => {
            const byName = String(name || '').trim().toLowerCase() === raw.toLowerCase();
            const byNum = inputNum > 0 && parseClassNumber(name) === inputNum;
            return byName || byNum;
          });
          if (mapMatch?.[1]) return mapMatch[1];
        }
        return null;
      };
      try {
        if (isApiLayerEnabled()) {
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
      payload.classId = await resolveClassIdFromInput();
      if (!payload.classId) {
        return { error: 'Class could not be resolved. Please select a valid class.' };
      }
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
    if (!supabase || currentUser?.isDemo) return { error: 'Supabase is not configured.' };
    const schoolId = currentUser?.schoolId;
    if (!schoolId) {
      setAuthError('Your account is not linked to a school.');
      return { error: 'Your account is not linked to a school.' };
    }
    try {
      if (isApiLayerEnabled()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.insertTeacherClassAssignmentApi(token, teacherId, className, subject, schoolId);
        setData((prev) => upsertTeacherClassAssignmentInData(prev, { teacherId, className, subject }));
      } else {
        const classIdMap = await repo.fetchClassIdMap(supabase, schoolId);
        await repo.insertTeacherClassAssignment(supabase, teacherId, className, subject, classIdMap);
        await refreshData();
      }
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to assign teacher.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const changeTeacherClass = async (oldTeacherId, newTeacherId, className, subject) => {
    if (!supabase || currentUser?.isDemo) return;
    const schoolId = currentUser?.schoolId;
    if (!schoolId) return;
    try {
      if (isApiLayerEnabled()) {
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
        setData((prev) =>
          upsertTeacherClassAssignmentInData(prev, { teacherId: newTeacherId, className, subject })
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
        await refreshData();
      }
    } catch (err) {
      setAuthError(err?.message || 'Failed to update assignment.');
    }
  };

  const createTest = async (test) => {
    if (!supabase || currentUser?.isDemo) {
      return { error: currentUser?.isDemo ? 'Demo mode cannot create tests.' : 'Supabase is not configured.' };
    }
    const createdBy = currentUser?.role === 'teacher' ? resolveTeacherId(currentUser.id) : null;
    const teacherRow = (dataRef.current.teachers || []).find((t) => t.id === createdBy) || null;
    const subjectRow =
      (dataRef.current.subjectRows || []).find(
        (s) => normalizeSubject(s.name) === normalizeSubject(test?.subject || teacherRow?.subject)
      ) || null;

    const resolveClassId = () => {
      if (test?.classId) return test.classId;
      if (test?.class_id) return test.class_id;
      const classes = dataRef.current.schoolClasses || [];
      const targetClass = test?.className ?? test?.class;
      if (targetClass != null && targetClass !== '') {
        const classNum = parseClassNumber(targetClass);
        const byNumber = classes.find((c) => String(c.class) === String(classNum));
        if (byNumber?.id) return byNumber.id;
      }
      const teacherClasses = teacherRow?.classes || [];
      if (teacherClasses.length === 1) {
        const classNum = parseClassNumber(teacherClasses[0].class);
        const byTeacherClass = classes.find((c) => String(c.class) === String(classNum));
        if (byTeacherClass?.id) return byTeacherClass.id;
      }
      if (classes.length === 1) return classes[0].id;
      return null;
    };

    const testPayload = {
      ...test,
      name: String(test?.name || test?.title || '').trim(),
      classId: resolveClassId(),
      subjectId: test?.subjectId || test?.subject_id || subjectRow?.id || null,
      schoolId: currentUser?.schoolId ?? test?.schoolId,
    };
    if (!testPayload.name) return { error: 'Test name is required.' };
    if (!testPayload.classId) return { error: 'Please select or assign a class before creating a test.' };
    if (!createdBy) return { error: 'Teacher identity is missing. Please sign in again.' };
    try {
      let newId = null;
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
        if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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

  const resolveTeacherId = useCallback((teacherId) => {
    const teachers = data.teachers || [];
    const candidate = teacherId || currentUser?.id || null;
    if (candidate && teachers.some((t) => t.id === candidate)) return candidate;
    if (currentUser?.authUserId) {
      const byAuth = teachers.find((t) => t.userId === currentUser.authUserId);
      if (byAuth?.id) return byAuth.id;
    }
    if (currentUser?.email) {
      const byEmail = teachers.find((t) => normalizeEmail(t.email) === normalizeEmail(currentUser.email));
      if (byEmail?.id) return byEmail.id;
    }
    return candidate;
  }, [data.teachers, currentUser]);

  const getCurrentTeacherId = useCallback(
    () => resolveTeacherId(currentUser?.id || null),
    [resolveTeacherId, currentUser?.id]
  );

  const getCurrentTeacher = useCallback(() => {
    const id = getCurrentTeacherId();
    return (data.teachers || []).find((t) => t.id === id) || null;
  }, [data.teachers, getCurrentTeacherId]);

  const getTeacherRelevantTestIds = useCallback((teacherId) => {
    const effectiveTeacherId = resolveTeacherId(teacherId);
    if (!effectiveTeacherId) return new Set();
    const teacher = data.teachers.find((t) => t.id === effectiveTeacherId);
    const subjects = new Set((teacher?.classes || []).map((c) => normalizeSubject(c.subject)).filter(Boolean));
    if (teacher?.subject) subjects.add(normalizeSubject(teacher.subject));

    const ids = new Set();
    for (const t of data.tests || []) {
      const creatorMatch = t.created_by_teacher_id && t.created_by_teacher_id === effectiveTeacherId;
      const domainMatch = subjects.size > 0 && subjects.has(normalizeSubject(t.domain));
      if (creatorMatch || domainMatch) ids.add(t.id);
    }
    return ids;
  }, [data.teachers, data.tests, resolveTeacherId]);

  const getStudentPerformanceForTeacher = useCallback((studentId, teacherId) => {
    const effectiveTeacherId = resolveTeacherId(teacherId);
    const student = data.students.find((s) => s.id === studentId);
    if (!student) return null;

    const allowedTestIds = getTeacherRelevantTestIds(effectiveTeacherId);
    const filteredScores = (student.scores || []).filter((sc) => allowedTestIds.has(sc.testId));
    const overallScore =
      filteredScores.length > 0
        ? filteredScores.reduce((acc, sc) => acc + sc.score, 0) / filteredScores.length
        : 0;

    const subjectWise = {};
    const topicWise = {};
    const testWise = {};

    filteredScores.forEach((sc) => {
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
  }, [data, getTeacherRelevantTestIds, resolveTeacherId]);

  const getTeacherPerformance = useCallback(
    (teacherId) => {
      const effectiveTeacherId = resolveTeacherId(teacherId);
      const rosterIds = collectStudentIdsForTeacher(data, effectiveTeacherId);
      const assignedStudents = data.students.filter((s) => rosterIds.has(s.id));

      if (assignedStudents.length === 0) {
        return { totalStudents: 0, avgPerformance: 0, classPerformance: {}, studentDetails: [] };
      }

      const studentDetails = assignedStudents.map((s) => {
        const perf = getStudentPerformanceForTeacher(s.id, effectiveTeacherId);
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
    [data, getStudentPerformanceForTeacher, resolveTeacherId]
  );

  const getTeacherAssignedStudents = useCallback((teacherId) => {
    const effectiveTeacherId = resolveTeacherId(teacherId);
    const rosterIds = collectStudentIdsForTeacher(data, effectiveTeacherId);
    return data.students.filter((s) => rosterIds.has(s.id));
  }, [data, resolveTeacherId]);

  const assignStudentsToTeacher = async (studentIds, teacherId) => {
    if (!supabase) return;
    try {
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
      if (isApiLayerEnabled()) {
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
    if (!supabase) return { error: 'Supabase is not configured.' };
    let targetSchoolId = currentUser?.schoolId || null;
    // Fallback for legacy seed school users that are role-mapped but not directly linked.
    if (!targetSchoolId && currentUser?.role === 'school') {
      try {
        const schools = await schoolApi.fetchSchoolsList();
        if ((schools || []).length === 1) {
          targetSchoolId = schools[0].id;
          setCurrentUser((prev) => (prev ? { ...prev, schoolId: targetSchoolId, schoolName: schools[0].name } : prev));
        }
      } catch {
        // Keep existing error handling below.
      }
    }
    if (!targetSchoolId) {
      const msg = 'Your account is not linked to a school, so class cannot be created.';
      setAuthError(msg);
      return { error: msg };
    }
    try {
      if (isApiLayerEnabled()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.insertClassApi(token, targetSchoolId, String(className));
      } else {
        await repo.insertClass(supabase, { schoolId: targetSchoolId, className: String(className) });
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to add class.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const addSubject = async (subjectName) => {
    if (!supabase) return { error: 'Supabase is not configured.' };
    const schoolId = currentUser?.schoolId || null;
    if (!schoolId) {
      const msg = 'Your account is not linked to a school, so subject cannot be created.';
      setAuthError(msg);
      return { error: msg };
    }
    const name = String(subjectName || '').trim();
    if (!name) return { error: 'Subject name is required.' };
    try {
      if (isApiLayerEnabled()) {
        const token = await getAccessToken();
        if (!token) return { error: 'Your session has expired. Please sign in again.' };
        await schoolApi.insertSubjectApi(token, schoolId, name);
      } else {
        return { error: 'Subject creation is available in API mode.' };
      }
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to add subject.';
      setAuthError(msg);
      return { error: msg };
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
        getStudentPerformanceForTeacher,
        getTeacherPerformance,
        getTeacherRelevantTestIds,
        getTeacherAssignedStudents,
        getCurrentTeacher,
        getCurrentTeacherId,
        assignStudentsToTeacher,
        assignStudentToTeacherBySubject,
        getClassStudents,
        getSchoolClasses,
        addClass,
        addSubject,
        createSchool,
        deleteSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};
