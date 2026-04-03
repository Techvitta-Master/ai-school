import { createElement } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Users, BookOpen, Award } from 'lucide-react';

export default function CompareClasses() {
  const { data, currentUser, getTeacherPerformance } = useSchool();

  const myPerf = getTeacherPerformance(currentUser.id);

  const classData = {};
  data.students.forEach(s => {
    const key = `${s.class}-${s.section}`;
    if (!classData[key]) {
      classData[key] = {
        name: key,
        students: [],
        scores: [],
        chapterScores: {}
      };
    }
    classData[key].students.push(s);
    const studentPerf = data.tests.reduce((acc, test) => {
      const score = s.scores.find(sc => sc.testId === test.id);
      if (score) {
        acc.push(score.score);
        const chapterKey = `Ch${test.chapter}`;
        if (!classData[key].chapterScores[chapterKey]) {
          classData[key].chapterScores[chapterKey] = [];
        }
        classData[key].chapterScores[chapterKey].push(score.score);
      }
      return acc;
    }, []);
    classData[key].scores.push(...studentPerf);
  });

  Object.keys(classData).forEach(key => {
    const scores = classData[key].scores;
    classData[key].avgScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
      : 0;
    classData[key].totalStudents = classData[key].students.length;
    classData[key].passRate = scores.length > 0 
      ? Math.round((scores.filter(s => s >= 50).length / scores.length) * 100) 
      : 0;
  });

  const comparisonData = Object.values(classData).map(c => ({
    name: `Class ${c.name}`,
    avgScore: c.avgScore,
    passRate: c.passRate,
    students: c.totalStudents
  }));

  const chapterComparison = {};
  Object.keys(classData).forEach(key => {
    Object.entries(classData[key].chapterScores).forEach(([chapter, scores]) => {
      if (!chapterComparison[chapter]) chapterComparison[chapter] = {};
      chapterComparison[chapter][key] = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
        : 0;
    });
  });

  const chapterData = Object.entries(chapterComparison).map(([chapter, scores]) => ({
    chapter,
    ...scores
  }));

  const otherTeachers = data.teachers.filter(t => t.id !== currentUser.id).map(t => {
    const perf = getTeacherPerformance(t.id);
    return {
      name: t.name,
      students: perf?.totalStudents || 0,
      avgScore: Math.round(perf?.avgPerformance || 0)
    };
  });

  const isMyClass = (className) => {
    return data.students.some(s => 
      `${s.class}-${s.section}` === className && s.assignedTeacher === currentUser.id
    );
  };

  const colorToClasses = {
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Compare Classes</h2>
          <p className="text-sm text-gray-500">View performance comparison across sections</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'My Classes', value: comparisonData.filter(c => isMyClass(c.name.replace('Class ', ''))).length, icon: BookOpen, color: 'emerald' },
          { label: 'Total Classes', value: comparisonData.length, icon: Users, color: 'indigo' },
          { label: 'My Avg Score', value: `${Math.round(myPerf?.avgPerformance || 0)}%`, icon: TrendingUp, color: 'amber' },
          { label: 'Rank', value: '#1', icon: Award, color: 'purple' },
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Class Performance Comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="avgScore" fill="#10b981" radius={[8, 8, 0, 0]} name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full" />
              <span className="text-gray-500">My Classes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full" />
              <span className="text-gray-500">Other Classes</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pass Rate Comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="passRate" fill="#6366f1" radius={[8, 8, 0, 0]} name="Pass Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Chapter-wise Performance</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chapterData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="chapter" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip />
              {Object.keys(classData).map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={isMyClass(key) ? '#10b981' : '#6366f1'}
                  strokeWidth={isMyClass(key) ? 3 : 1}
                  dot={{ r: 4 }}
                  name={`Class ${key}`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Teacher Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-emerald-50">
                <td className="px-6 py-4 font-medium text-gray-900">{currentUser?.name} (You)</td>
                <td className="px-6 py-4">{myPerf?.totalStudents || 0}</td>
                <td className="px-6 py-4 font-semibold text-emerald-600">{Math.round(myPerf?.avgPerformance || 0)}%</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-xs rounded-full">Best</span>
                </td>
              </tr>
              {otherTeachers.map(t => (
                <tr key={t.name}>
                  <td className="px-6 py-4 text-gray-900">{t.name}</td>
                  <td className="px-6 py-4">{t.students}</td>
                  <td className="px-6 py-4">{t.avgScore}%</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Normal</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
