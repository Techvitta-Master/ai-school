import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';
import { createElement } from 'react';

let mockUseSchoolReturn;

vi.mock('./context/SchoolContext', () => ({
  SchoolProvider: ({ children }) => children,
  useSchool: () => mockUseSchoolReturn,
}));

vi.mock('recharts', () => {
  const Dummy = ({ children }) => createElement('div', null, children);
  const DummyWithProps = ({ children }) => createElement('div', null, children);

  return {
    ResponsiveContainer: Dummy,
    AreaChart: Dummy,
    Area: DummyWithProps,
    XAxis: DummyWithProps,
    YAxis: DummyWithProps,
    Tooltip: DummyWithProps,
    BarChart: Dummy,
    Bar: DummyWithProps,
    LineChart: Dummy,
    Line: DummyWithProps,
    CartesianGrid: DummyWithProps,
    RadarChart: Dummy,
    PolarGrid: DummyWithProps,
    PolarAngleAxis: DummyWithProps,
    PolarRadiusAxis: DummyWithProps,
    PieChart: Dummy,
    Pie: DummyWithProps,
    Cell: DummyWithProps,
  };
});

const baseMockData = {
  teachers: [
    { id: 't1', name: 'Teacher One', email: 'teacher@x.com', subject: 'Mathematics', classes: [], students: [] },
  ],
  students: [
    {
      id: 's1',
      name: 'Student One',
      email: 'student@x.com',
      class: 6,
      assignedTeacher: 't1',
      rollNo: 1,
      scores: [
        { id: 'sc1', testId: 'test1', date: '2020-01-01', score: 60 },
        { id: 'sc2', testId: 'test1', date: '2020-02-01', score: 70 },
      ],
      attendance: 90,
    },
  ],
  tests: [
    {
      id: 'test1',
      title: 'Test 1',
      chapter: 1,
      domain: 'Mathematics',
      topics: ['A'],
      duration: 30,
      totalMarks: 100,
      type: 'Weekly Test',
      createdAt: '2020-01-01T00:00:00.000Z',
    },
  ],
  schoolClasses: [{ id: 'cl1', class: 6, className: '6', teachers: [] }],
  syllabus: {
    themes: [
      {
        theme: 'th1',
        title: 'Math',
        domain: 'Mathematics',
        chapters: [{ chapter_number: 1, title: 'Ch 1', topics: ['A'] }],
      },
    ],
  },
  classes: [6],
  subjects: ['Mathematics'],
};

const studentPerf = {
  overallScore: 65,
  subjectWise: { Mathematics: 65 },
  topicWise: { 'Time Zones': 45 },
  testWise: { 'Test 1': 70 },
  weakTopics: [['Time Zones', 45]],
  strongTopics: [['Maps', 80]],
};

const teacherPerf = {
  totalStudents: 1,
  avgPerformance: 65,
  classPerformance: [{ name: '6-A', score: 65 }],
  studentDetails: [],
};

beforeEach(() => {
  const teacherRow = baseMockData.teachers[0];
  mockUseSchoolReturn = {
    data: baseMockData,
    currentUser: null,
    login: vi.fn(),
    logout: vi.fn(),
    authLoading: false,
    dataLoading: false,
    authError: null,
    getStudentPerformance: () => studentPerf,
    getTeacherPerformance: () => teacherPerf,
    getCurrentTeacher: () => teacherRow,
    getCurrentTeacherId: () => teacherRow.id,
    getTeacherRelevantTestIds: () => new Set(['test1']),
  };
});

describe('Role-based routing', () => {
  it('redirects /admin to /teacher when currentUser.role is teacher', async () => {
    mockUseSchoolReturn.currentUser = { role: 'teacher', id: 't1', name: 'Teacher One', subject: 'Mathematics' };
    window.history.pushState({}, '', '/admin');

    render(<App />);

    await waitFor(() => {
      // After redirect, teacher layout sidebar item should be visible
      expect(screen.getByText('My Class')).toBeInTheDocument();
    });
  });

  it('renders teacher dashboard at /teacher', async () => {
    mockUseSchoolReturn.currentUser = { role: 'teacher', id: 't1', name: 'Teacher One', subject: 'Mathematics' };
    window.history.pushState({}, '', '/teacher');

    render(<App />);

    await waitFor(() => {
      // Sidebar nav items visible in teacher layout
      expect(screen.getAllByText('My Class').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Upload & Analyze').length).toBeGreaterThan(0);
    });
  });

  it('redirects to /login when not authenticated', async () => {
    mockUseSchoolReturn.currentUser = null;
    mockUseSchoolReturn.authLoading = false;
    mockUseSchoolReturn.dataLoading = false;
    window.history.pushState({}, '', '/admin');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });
  });
});

