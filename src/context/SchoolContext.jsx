/* eslint react-refresh/only-export-components: off */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { emptySchoolData } from '../lib/schoolEmptyState';
import { resolveCurrentUser } from '../lib/resolveCurrentUser';
import * as repo from '../lib/schoolRepository';

const SchoolContext = createContext();
const DEMO_PASSWORD = '123456';
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

  const refreshData = useCallback(async () => {
    if (!supabase || currentUser?.isDemo) return;
    const schoolId = currentUser?.role === 'school' ? currentUser.schoolId : null;
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
          setCurrentUser(getStoredDemoUser());
          return;
        }
        let resolved = null;
        try {
          resolved = await resolveCurrentUser(supabase, user);
        } catch (err) {
          setAuthError(err?.message || 'Failed to resolve user.');
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const user = session?.user ?? null;
        if (!user) {
          setCurrentUser(getStoredDemoUser());
          return;
        }
        clearStoredDemoUser();
        const resolved = await resolveCurrentUser(supabase, user);
        setCurrentUser(resolved);
      } catch (err) {
        setAuthError(err?.message || 'Failed to refresh user.');
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
        const remote = await repo.loadSchoolData(supabase, { schoolId });
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
    const normalizedEmail = (email || '').trim().toLowerCase();
    const demoUser = DEMO_USERS[normalizedEmail];

    // When Supabase is configured, always try real Auth first.
    // This ensures RLS works when demo accounts are registered in Supabase Auth.
    // If real auth fails AND this is a known demo account, fall through to localStorage demo.
    if (supabase) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!signInError && signInData?.user) {
        clearStoredDemoUser();
        const nextUser = await resolveCurrentUser(supabase, signInData.user);
        setCurrentUser(nextUser);
        return { success: true, role: nextUser?.role ?? null };
      }

      // Real auth failed — only continue if this is a known demo account
      if (!demoUser || password !== DEMO_PASSWORD) {
        setAuthError(signInError?.message || 'Invalid credentials. Please try again.');
        return { success: false, role: null };
      }
      // Demo account not yet registered in Supabase Auth — fall through to localStorage demo below
    }

    // Fallback: localStorage-only demo (Supabase not configured, or demo account not yet registered)
    if (demoUser && password === DEMO_PASSWORD) {
      setCurrentUser(demoUser);
      storeDemoUser(demoUser);
      return { success: true, role: demoUser.role };
    }

    if (!supabase) {
      setAuthError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return { success: false, role: null };
    }

    setAuthError('Invalid credentials. Please try again.');
    return { success: false, role: null };
  };

  const logout = async () => {
    setAuthError(null);
    try {
      clearStoredDemoUser();
      await supabase?.auth.signOut();
    } finally {
      setCurrentUser(null);
      setData({ ...emptySchoolData });
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
      await repo.insertTeacher(supabase, payload);
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
      await repo.deleteTeacher(supabase, id);
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
      // Auto-create section if it doesn't exist yet (non-fatal: admin may lack write
      // access if section already exists or RLS blocks a duplicate upsert).
      try {
        await repo.insertSection(supabase, student.class, student.section);
      } catch (sectionErr) {
        console.warn('Section upsert skipped (may already exist):', sectionErr?.message);
      }
      const sectionIdMap = await repo.fetchSectionIdMap(supabase);
      await repo.insertStudent(supabase, payload, sectionIdMap);
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to add student.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const removeStudent = async (id) => {
    const sessionErr = await ensureRealSession();
    if (sessionErr) return { error: sessionErr };
    try {
      await repo.deleteStudent(supabase, id);
      await refreshData();
      return { error: null };
    } catch (err) {
      const msg = err?.message || 'Failed to remove student.';
      setAuthError(msg);
      return { error: msg };
    }
  };

  const assignTeacherToSection = async (teacherId, className, section, subject) => {
    if (!supabase || currentUser?.isDemo) return;
    try {
      const sectionIdMap = await repo.fetchSectionIdMap(supabase);
      await repo.insertTeacherSectionAssignment(supabase, teacherId, className, section, subject, sectionIdMap);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to assign teacher.');
    }
  };

  const changeTeacherSection = async (oldTeacherId, newTeacherId, className, section, subject) => {
    if (!supabase || currentUser?.isDemo) return;
    try {
      const sectionIdMap = await repo.fetchSectionIdMap(supabase);
      await repo.updateTeacherSectionAssignmentTeacher(
        supabase,
        oldTeacherId,
        newTeacherId,
        className,
        section,
        subject,
        sectionIdMap
      );
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to update assignment.');
    }
  };

  const createTest = async (test) => {
    if (!supabase || currentUser?.isDemo) return;
    const createdBy =
      currentUser?.role === 'teacher' ? currentUser.id : null;
    try {
      await repo.createTestRecord(supabase, test, { createdByTeacherId: createdBy });
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to create test.');
    }
  };

  const removeTest = async (id) => {
    if (!supabase || currentUser?.isDemo) return;
    try {
      await repo.deleteTest(supabase, id);
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
      await repo.insertScore(supabase, studentId, testId, scoreData);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to add score.');
    }
  };

  const updateScore = async (studentId, scoreId, newScore) => {
    if (!supabase || currentUser?.isDemo) return;
    try {
      await repo.updateScoreValue(supabase, scoreId, newScore);
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
      await repo.insertTestAnalysisRow(supabase, {
        testId,
        teacherId: currentUser.id,
        bucket,
        storagePath,
        analysis,
      });
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to save test analysis.');
    }
  };

  /**
   * Save an answer sheet record after the file has been uploaded to storage.
   * Optionally resolves the studentId from rollNo + sectionId.
   * @param {{ testId: string, studentId?: string, rollNo?: string, sectionId?: string, storagePath: string, bucket?: string }} payload
   */
  const saveAnswerSheet = async (payload) => {
    if (!supabase || currentUser?.isDemo || currentUser?.role !== 'teacher') return null;
    try {
      let studentId = payload.studentId || null;
      if (!studentId && payload.rollNo && payload.sectionId) {
        studentId = await repo.findStudentIdByRollNo(supabase, payload.rollNo, payload.sectionId);
      }
      const id = await repo.insertAnswerSheet(supabase, {
        testId: payload.testId,
        studentId,
        rollNo: payload.rollNo || null,
        bucket: payload.bucket || 'answer-sheets',
        storagePath: payload.storagePath || '',
        teacherId: currentUser.id,
      });
      return id;
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
      await repo.saveEvaluation(supabase, studentId, testId, {
        ...evalData,
        gradedByTeacherId: teacherId,
      });
      if (evalData.answerSheetId) {
        await repo.updateAnswerSheetStatus(supabase, evalData.answerSheetId, 'evaluated');
      }
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to save evaluation.');
    }
  };

  const getStudentPerformance = (studentId) => {
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
        const theme = data.syllabus.themes.find((t) => t.chapters.some((c) => c.chapter_number === test.chapter));
        const subject = theme?.domain || 'General';

        if (!subjectWise[subject]) subjectWise[subject] = { total: 0, count: 0 };
        subjectWise[subject].total += sc.score;
        subjectWise[subject].count++;

        test.topics.forEach((topic) => {
          if (!topicWise[topic]) topicWise[topic] = { total: 0, count: 0 };
          topicWise[topic].total += sc.topicScores?.[topic] || sc.score / (test.topics.length || 1);
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
  };

  const getTeacherPerformance = (teacherId) => {
    const teacher = data.teachers.find((t) => t.id === teacherId);
    if (!teacher) return null;

    const assignedStudents = data.students.filter((s) => s.assignedTeacher === teacherId);

    if (assignedStudents.length === 0) {
      return { totalStudents: 0, avgPerformance: 0, classPerformance: [], studentDetails: [] };
    }

    const studentDetails = assignedStudents.map((s) => {
      const perf = getStudentPerformance(s.id);
      return { ...s, performance: perf };
    });

    const totalAvg =
      studentDetails.reduce((acc, s) => acc + (s.performance?.overallScore || 0), 0) / studentDetails.length;

    const classPerformance = {};
    studentDetails.forEach((s) => {
      const key = `${s.class}-${s.section}`;
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
  };

  const getTeacherAssignedStudents = (teacherId) => {
    return data.students.filter((s) => s.assignedTeacher === teacherId);
  };

  const assignStudentsToTeacher = async (studentIds, teacherId) => {
    if (!supabase) return;
    try {
      await repo.assignStudentsToTeacher(supabase, studentIds, teacherId);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to assign students.');
    }
  };

  const getSectionStudents = (className, section) => {
    return data.students.filter((s) => s.class === className && s.section === section);
  };

  const getSections = () => {
    return data.sections;
  };

  const addSection = async (className, section) => {
    const existing = data.sections.find((s) => s.class === className && s.section === section);
    if (existing) return;
    if (!supabase) return;
    try {
      await repo.insertSection(supabase, className, section);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to add section.');
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
        removeStudent,
        assignTeacherToSection,
        changeTeacherSection,
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
        getSectionStudents,
        getSections,
        addSection,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};
