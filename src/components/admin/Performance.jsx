import { useState, useMemo, createElement } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, BookOpen, Award, Edit } from 'lucide-react';

export default function Performance() {
  const { data, getStudentPerformance, getTeacherPerformance, updateScore } = useSchool();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editScore, setEditScore] = useState(null);
  const [newScore, setNewScore] = useState('');

  const handleUpdateScore = (studentId, scoreId) => {
    updateScore(studentId, scoreId, parseInt(newScore));
    setEditScore(null);
    setNewScore('');
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const colorToClasses = {
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  };

  const overallStats = useMemo(() => {
    return {
      totalStudents: data.students.length,
      avgScore: Math.round(
        data.students.reduce((acc, s) => {
          const perf = getStudentPerformance(s.id);
          return acc + (perf?.overallScore || 0);
        }, 0) / data.students.length
      ),
      totalTests: data.tests.length,
      subjectCount: data.syllabus.themes.length
    };
  }, [data, getStudentPerformance]);

  const subjectPerformance = useMemo(() => {
    return data.syllabus.themes.map(theme => {
      const avgScore = data.students.reduce((acc, s) => {
        const perf = getStudentPerformance(s.id);
        return acc + (perf?.subjectWise?.[theme.domain] || 0);
      }, 0) / (data.students.length || 1);
      return { name: theme.domain.split(' ')[0], score: Math.round(avgScore) };
    });
  }, [data, getStudentPerformance]);

  const teacherPerformance = useMemo(() => {
    return data.teachers.map(t => {
      const perf = getTeacherPerformance(t.id);
      return { name: t.name.split(' ')[0], students: perf?.totalStudents || 0, avgScore: Math.round(perf?.avgPerformance || 0) };
    });
  }, [data, getTeacherPerformance]);

  const weakStudents = useMemo(() => {
    return data.students
      .map(s => ({ ...s, perf: getStudentPerformance(s.id) }))
      .filter(s => s.perf?.overallScore < 50)
      .sort((a, b) => a.perf.overallScore - b.perf.overallScore);
  }, [data, getStudentPerformance]);

  const strongStudents = useMemo(() => {
    return data.students
      .map(s => ({ ...s, perf: getStudentPerformance(s.id) }))
      .filter(s => s.perf?.overallScore >= 80)
      .sort((a, b) => b.perf.overallScore - a.perf.overallScore);
  }, [data, getStudentPerformance]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Students', value: overallStats.totalStudents, icon: Users, color: 'indigo' },
          { label: 'Average Score', value: `${overallStats.avgScore}%`, icon: TrendingUp, color: 'emerald' },
          { label: 'Total Tests', value: overallStats.totalTests, icon: BookOpen, color: 'amber' },
          { label: 'Top Performers', value: strongStudents.length, icon: Award, color: 'purple' },
        ].map(({ label, value, icon: Icon, color }) => {
          const classes = colorToClasses[color] || colorToClasses.indigo;
          return (
            <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${classes.bg} rounded-xl flex items-center justify-center`}>
                  {createElement(Icon, { className: `w-6 h-6 ${classes.text}` })}
                </div>
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Teacher Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teacherPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="avgScore" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Students Needing Attention</h3>
          {weakStudents.length > 0 ? (
            <div className="space-y-3">
              {weakStudents.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="font-semibold text-red-600">{s.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500">Class {s.class}-{s.section}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-red-600">{Math.round(s.perf.overallScore)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">All students are performing well!</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
          {strongStudents.length > 0 ? (
            <div className="space-y-3">
              {strongStudents.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="font-semibold text-green-600">{s.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500">Class {s.class}-{s.section}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-green-600">{Math.round(s.perf.overallScore)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No top performers yet!</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Student Scores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
            <select
              value={selectedStudent || ''}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl"
            >
              <option value="">Select a student</option>
              {data.students.map(s => (
                <option key={s.id} value={s.id}>{s.name} (Class {s.class}-{s.section})</option>
              ))}
            </select>
          </div>
        </div>

        {selectedStudent && (
          <div className="mt-4 space-y-3">
            {(data.students.find(s => s.id === selectedStudent)?.scores || []).map(score => {
              const test = data.tests.find(t => t.id === score.testId);
              return (
                <div key={score.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">{test?.title || 'Unknown Test'}</p>
                    <p className="text-sm text-gray-500">{new Date(score.date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editScore === score.id ? (
                      <>
                        <input
                          type="number"
                          value={newScore}
                          onChange={(e) => setNewScore(e.target.value)}
                          className="w-20 px-3 py-1 border border-gray-300 rounded-lg"
                          min="0"
                          max="100"
                        />
                        <button
                          onClick={() => handleUpdateScore(selectedStudent, score.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditScore(null); setNewScore(''); }}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-gray-900">{score.score}%</span>
                        <button
                          onClick={() => { setEditScore(score.id); setNewScore(score.score.toString()); }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
