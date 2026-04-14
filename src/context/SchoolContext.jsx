/* eslint react-refresh/only-export-components: off */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { emptySchoolData } from '../lib/schoolEmptyState';
import { resolveCurrentUser } from '../lib/resolveCurrentUser';
import * as repo from '../lib/schoolRepository';

const SchoolContext = createContext();
const DEMO_PASSWORD = '123456';
const DEMO_USER_STORAGE_KEY = 'demoCurrentUser';
const DEMO_SCHOOL_ID = 'a0000001-0000-4000-8000-000000000001';
const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const DEMO_USERS = {
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_ADMIN || 'admin@school.com')]: {
    role: 'admin',
    id: 'admin',
    name: 'School Admin',
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_SCHOOL || 'school@school.com')]: {
    role: 'school',
    id: 'school-demo',
    name: 'Riverside School Admin',
    schoolId: DEMO_SCHOOL_ID,
    schoolName: 'Riverside International School',
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_TEACHER || 'priya@school.com')]: {
    role: 'teacher',
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    name: 'Priya Sharma',
    subject: 'Social Science',
    schoolId: DEMO_SCHOOL_ID,
  },
  [normalizeEmail(import.meta.env.VITE_DEMO_EMAIL_STUDENT || 'aarav.patel@student.com')]: {
    role: 'student',
    id: 'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    name: 'Aarav Patel',
    schoolId: DEMO_SCHOOL_ID,
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
    if (!supabase) return;
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

    if (demoUser && password === DEMO_PASSWORD) {
      setCurrentUser(demoUser);
      storeDemoUser(demoUser);
      return { success: true, role: demoUser.role };
    }

    if (!supabase) {
      setAuthError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return { success: false, role: null };
    }

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
      return { success: false, role: null };
    }

    clearStoredDemoUser();
    const nextUser = await resolveCurrentUser(supabase, signInData.user);
    setCurrentUser(nextUser);
    return { success: true, role: nextUser?.role ?? null };
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

  const addTeacher = async (teacher) => {
    if (!supabase) return;
    try {
      const payload = { ...teacher };
      if (currentUser?.role === 'school' && currentUser.schoolId) {
        payload.schoolId = currentUser.schoolId;
      }
      await repo.insertTeacher(supabase, payload);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to add teacher.');
    }
  };

  const removeTeacher = async (id) => {
    if (!supabase) return;
    try {
      await repo.deleteTeacher(supabase, id);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to remove teacher.');
    }
  };

  const addStudent = async (student) => {
    if (!supabase) return;
    try {
      const sectionIdMap = await repo.fetchSectionIdMap(supabase);
      const payload = { ...student };
      if (currentUser?.role === 'school' && currentUser.schoolId) {
        payload.schoolId = currentUser.schoolId;
      }
      await repo.insertStudent(supabase, payload, sectionIdMap);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to add student.');
    }
  };

  const removeStudent = async (id) => {
    if (!supabase) return;
    try {
      await repo.deleteStudent(supabase, id);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to remove student.');
    }
  };

  const assignTeacherToSection = async (teacherId, className, section, subject) => {
    if (!supabase) return;
    try {
      const sectionIdMap = await repo.fetchSectionIdMap(supabase);
      await repo.insertTeacherSectionAssignment(supabase, teacherId, className, section, subject, sectionIdMap);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to assign teacher.');
    }
  };

  const changeTeacherSection = async (oldTeacherId, newTeacherId, className, section, subject) => {
    if (!supabase) return;
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
    if (!supabase) return;
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
    if (!supabase) return;
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

    if (!supabase) return;
    try {
      await repo.insertScore(supabase, studentId, testId, scoreData);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to add score.');
    }
  };

  const updateScore = async (studentId, scoreId, newScore) => {
    if (!supabase) return;
    try {
      await repo.updateScoreValue(supabase, scoreId, newScore);
      await refreshData();
    } catch (err) {
      setAuthError(err?.message || 'Failed to update score.');
    }
  };

  const uploadTestAnalysis = async (testId, payload) => {
    if (!supabase || currentUser?.role !== 'teacher') return;
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
