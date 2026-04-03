/* eslint react-refresh/only-export-components: off */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initialData } from '../data/mockData';
import { supabase } from '../lib/supabaseClient';
import { fetchSchoolData, persistSchoolData } from '../lib/schoolStateStore';

const SchoolContext = createContext();

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) throw new Error('useSchool must be used within SchoolProvider');
  return context;
};

const generateId = () => Math.random().toString(36).substr(2, 9);

export const SchoolProvider = ({ children }) => {
  const [data, setData] = useState(initialData);
  const dataRef = useRef(data);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const hasHydratedRef = useRef(false);

  const deriveCurrentUserFromSupabase = (user) => {
    if (!user) return null;

    const email = user.email;
    const name = user.user_metadata?.full_name || user.user_metadata?.name || email?.split('@')[0];
    const roleFromMetadata = user.user_metadata?.role;

    const localData = dataRef.current;

    // Preferred: store role in Supabase user_metadata.role
    const role = roleFromMetadata
      ? String(roleFromMetadata)
      : localData.teachers.some(t => t.email === email)
        ? 'teacher'
        : localData.students.some(s => s.email === email)
          ? 'student'
          : 'admin';

    if (role === 'admin') {
      return { role: 'admin', id: 'admin', name: name || 'School Admin' };
    }

    if (role === 'teacher') {
      const teacher = localData.teachers.find(t => t.email === email);
      if (!teacher) return { role: 'teacher', id: email, name: name || 'Teacher' };
      return { role: 'teacher', id: teacher.id, name: teacher.name };
    }

    if (role === 'student') {
      const student = localData.students.find(s => s.email === email);
      if (!student) return { role: 'student', id: email, name: name || 'Student' };
      return { role: 'student', id: student.id, name: student.name };
    }

    return null;
  };

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

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (sessionError) {
        setAuthError(sessionError.message);
        setCurrentUser(null);
        setAuthLoading(false);
        return;
      }

      const user = sessionData?.session?.user ?? null;
      setCurrentUser(deriveCurrentUserFromSupabase(user));
      setAuthLoading(false);
    };

    init();

    if (!supabase) return () => {};

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(deriveCurrentUserFromSupabase(user));
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!supabase) {
        setDataLoading(false);
        hasHydratedRef.current = true;
        return;
      }

      // Avoid hitting the DB while the user is logged out.
      if (!currentUser) {
        setDataLoading(false);
        hasHydratedRef.current = true;
        return;
      }

      try {
        const remote = await fetchSchoolData({ fallbackData: initialData });
        if (!isMounted) return;
        setData(remote);
      } catch (err) {
        // If tables aren't set up yet, keep the app usable with the embedded demo data.
        if (isMounted) {
          setAuthError(err?.message || 'Failed to load school data from Supabase.');
          setData(initialData);
        }
      } finally {
        if (isMounted) {
          setDataLoading(false);
          hasHydratedRef.current = true;
        }
      }
    };

    // Only attempt DB load after auth state is known.
    if (!authLoading) load();

    return () => {
      isMounted = false;
    };
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (!supabase) return;
    if (!hasHydratedRef.current) return;

    // Persist on every state change (simple approach; can be optimized later).
    persistSchoolData({ schoolData: data }).catch((err) => {
      setAuthError(err?.message || 'Failed to persist school data to Supabase.');
    });
  }, [data]);

  const login = async (email, password) => {
    setAuthError(null);

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

    const nextUser = deriveCurrentUserFromSupabase(signInData.user);
    setCurrentUser(nextUser);
    return { success: true, role: nextUser?.role ?? null };
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await supabase?.auth.signOut();
    } finally {
      setCurrentUser(null);
    }
  };

  // Teacher Management
  const addTeacher = (teacher) => {
    // Auth users are managed by Supabase; store only teacher profile data here.
    const newTeacher = { ...teacher, id: generateId(), students: [], classes: [] };
    setData(prev => ({ ...prev, teachers: [...prev.teachers, newTeacher] }));
    return newTeacher;
  };

  const removeTeacher = (id) => {
    setData(prev => ({ ...prev, teachers: prev.teachers.filter(t => t.id !== id) }));
  };

  // Student Management
  const addStudent = (student) => {
    // Auth users are managed by Supabase; store only student profile data here.
    const newStudent = { ...student, id: generateId(), scores: [] };
    setData(prev => ({ ...prev, students: [...prev.students, newStudent] }));
    return newStudent;
  };

  const removeStudent = (id) => {
    setData(prev => ({ ...prev, students: prev.students.filter(s => s.id !== id) }));
  };

  const assignTeacherToSection = (teacherId, className, section, subject) => {
    setData(prev => ({
      ...prev,
      teachers: prev.teachers.map(t => {
        if (t.id === teacherId) {
          const existingClass = t.classes.find(c => c.class === className && c.section === section && c.subject === subject);
          if (existingClass) return t;
          return { ...t, classes: [...t.classes, { class: className, section, subject }] };
        }
        return t;
      }),
      sections: prev.sections.map(s => {
        if (s.class === className && s.section === section) {
          const existing = s.teachers.find(t => t.teacherId === teacherId && t.subject === subject);
          if (existing) return s;
          return { ...s, teachers: [...s.teachers, { teacherId, subject }] };
        }
        return s;
      })
    }));
  };

  const changeTeacherSection = (oldTeacherId, newTeacherId, className, section, subject) => {
    setData(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.class === className && s.section === section) {
          return {
            ...s,
            teachers: s.teachers.map(t => {
              if (t.subject === subject && t.teacherId === oldTeacherId) {
                return { ...t, teacherId: newTeacherId };
              }
              return t;
            })
          };
        }
        return s;
      })
    }));
  };

  // Test Management
  const createTest = (test) => {
    const newTest = { ...test, id: generateId(), createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, tests: [...prev.tests, newTest] }));
    return newTest;
  };

  const removeTest = (id) => {
    setData(prev => ({ ...prev, tests: prev.tests.filter(t => t.id !== id) }));
  };

  // Score Management
  const addScore = (studentId, testId, scoreData) => {
    const test = data.tests.find(t => t.id === testId);
    if (!test) return;

    const score = {
      id: generateId(),
      testId,
      date: new Date().toISOString(),
      ...scoreData
    };

    setData(prev => ({
      ...prev,
      students: prev.students.map(s => {
        if (s.id === studentId) {
          return { ...s, scores: [...s.scores, score] };
        }
        return s;
      })
    }));
  };

  const updateScore = (studentId, scoreId, newScore) => {
    setData(prev => ({
      ...prev,
      students: prev.students.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            scores: s.scores.map(sc => {
              if (sc.id === scoreId) {
                return { ...sc, score: newScore, updatedAt: new Date().toISOString() };
              }
              return sc;
            })
          };
        }
        return s;
      })
    }));
  };

  const uploadTestAnalysis = (testId, analysis) => {
    setData(prev => ({
      ...prev,
      tests: prev.tests.map(t => {
        if (t.id === testId) {
          return { ...t, analysis, uploadedAt: new Date().toISOString() };
        }
        return t;
      })
    }));
  };

  const getStudentPerformance = (studentId) => {
    const student = data.students.find(s => s.id === studentId);
    if (!student) return null;

    const overallScore = student.scores.length > 0
      ? student.scores.reduce((acc, sc) => acc + sc.score, 0) / student.scores.length
      : 0;

    const subjectWise = {};
    const topicWise = {};
    const testWise = {};

    student.scores.forEach(sc => {
      const test = data.tests.find(t => t.id === sc.testId);
      if (test) {
        const theme = data.syllabus.themes.find(t => 
          t.chapters.some(c => c.chapter_number === test.chapter)
        );
        const subject = theme?.domain || 'General';
        
        if (!subjectWise[subject]) subjectWise[subject] = { total: 0, count: 0 };
        subjectWise[subject].total += sc.score;
        subjectWise[subject].count++;

        test.topics.forEach(topic => {
          if (!topicWise[topic]) topicWise[topic] = { total: 0, count: 0 };
          topicWise[topic].total += (sc.topicScores?.[topic] || sc.score / test.topics.length);
          topicWise[topic].count++;
        });

        testWise[test.title] = sc.score;
      }
    });

    Object.keys(subjectWise).forEach(sub => {
      subjectWise[sub] = subjectWise[sub].total / subjectWise[sub].count;
    });
    Object.keys(topicWise).forEach(top => {
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
    const teacher = data.teachers.find(t => t.id === teacherId);
    if (!teacher) return null;

    const assignedStudents = data.students.filter(s => 
      s.assignedTeacher === teacherId
    );

    if (assignedStudents.length === 0) {
      return { totalStudents: 0, avgPerformance: 0, classPerformance: [], studentDetails: [] };
    }

    const studentDetails = assignedStudents.map(s => {
      const perf = getStudentPerformance(s.id);
      return { ...s, performance: perf };
    });

    const totalAvg = studentDetails.reduce((acc, s) => acc + (s.performance?.overallScore || 0), 0) / studentDetails.length;

    const classPerformance = {};
    studentDetails.forEach(s => {
      const key = `${s.class}-${s.section}`;
      if (!classPerformance[key]) classPerformance[key] = { total: 0, count: 0 };
      classPerformance[key].total += s.performance?.overallScore || 0;
      classPerformance[key].count++;
    });

    Object.keys(classPerformance).forEach(key => {
      classPerformance[key] = classPerformance[key].total / classPerformance[key].count;
    });

    return { totalStudents: assignedStudents.length, avgPerformance: totalAvg, classPerformance, studentDetails };
  };

  const getTeacherAssignedStudents = (teacherId) => {
    return data.students.filter(s => s.assignedTeacher === teacherId);
  };

  const assignStudentsToTeacher = (studentIds, teacherId) => {
    setData(prev => ({
      ...prev,
      students: prev.students.map(s => {
        if (studentIds.includes(s.id)) {
          return { ...s, assignedTeacher: teacherId };
        }
        return s;
      })
    }));
  };

  const getSectionStudents = (className, section) => {
    return data.students.filter(s => s.class === className && s.section === section);
  };

  const getSections = () => {
    return data.sections;
  };

  const addSection = (className, section) => {
    const existing = data.sections.find(s => s.class === className && s.section === section);
    if (existing) return;
    setData(prev => ({
      ...prev,
      sections: [...prev.sections, { class: className, section, teachers: [] }]
    }));
  };

  return (
    <SchoolContext.Provider value={{
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
      addSection
    }}>
      {children}
    </SchoolContext.Provider>
  );
};
