import { createContext, useContext, useState, useEffect } from 'react';
import { initialData } from '../data/mockData';

const SchoolContext = createContext();

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) throw new Error('useSchool must be used within SchoolProvider');
  return context;
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const loadFromStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const SchoolProvider = ({ children }) => {
  const [data, setData] = useState(() => loadFromStorage('schoolData', initialData));
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    saveToStorage('schoolData', data);
  }, [data]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  const login = (role, email, password) => {
    if (role === 'admin') {
      if (email === 'admin@school.com' && password === 'admin123') {
        setCurrentUser({ role: 'admin', id: 'admin', name: 'School Admin' });
        return true;
      }
    } else if (role === 'teacher') {
      const teacher = data.teachers.find(t => t.email === email && t.password === password);
      if (teacher) {
        setCurrentUser({ role: 'teacher', id: teacher.id, name: teacher.name });
        return true;
      }
    } else if (role === 'student') {
      const student = data.students.find(s => s.email === email && s.password === password);
      if (student) {
        setCurrentUser({ role: 'student', id: student.id, name: student.name });
        return true;
      }
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  // Teacher Management
  const addTeacher = (teacher) => {
    const newTeacher = { ...teacher, id: generateId(), password: 'teacher123', students: [], classes: [] };
    setData(prev => ({ ...prev, teachers: [...prev.teachers, newTeacher] }));
    return newTeacher;
  };

  const removeTeacher = (id) => {
    setData(prev => ({ ...prev, teachers: prev.teachers.filter(t => t.id !== id) }));
  };

  // Student Management
  const addStudent = (student) => {
    const newStudent = { ...student, id: generateId(), password: 'student123', scores: [] };
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
