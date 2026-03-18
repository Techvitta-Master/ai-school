import { useSchool } from '../../context/SchoolContext';
import { FileText, TrendingUp, Calendar, Target, Award, Clock, ArrowRight, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg text-sm shadow-lg border border-slate-200">
        <p className="font-medium text-slate-800">{payload[0].payload.name}</p>
        <p className="text-indigo-600 font-semibold">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export default function StudentScores() {
  const { currentUser, data, getStudentPerformance } = useSchool();
  
  const student = data.students.find(s => s.id === currentUser.id);
  const perf = getStudentPerformance(currentUser.id);

  const sortedScores = [...(student?.scores || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const chartData = sortedScores.slice(0, 8).reverse().map(sc => {
    const test = data.tests.find(t => t.id === sc.testId);
    return {
      name: test?.title?.split(' ').slice(0, 2).join(' ') || 'Test',
      score: sc.score,
      date: new Date(sc.date).toLocaleDateString()
    };
  });

  const subjectData = Object.entries(perf?.subjectWise || {}).map(([name, score]) => ({
    name: name.split(' ')[0],
    score: Math.round(score)
  }));

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const getGrade = (score) => {
    if (score >= 90) return { grade: 'A+', color: 'text-emerald-600' };
    if (score >= 80) return { grade: 'A', color: 'text-emerald-600' };
    if (score >= 70) return { grade: 'B+', color: 'text-blue-600' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-600' };
    if (score >= 50) return { grade: 'C', color: 'text-amber-600' };
    return { grade: 'D', color: 'text-red-600' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {currentUser?.name}!</h1>
          <p className="text-slate-500 mt-1">Track your academic progress</p>
        </div>
        <Badge className="bg-indigo-100 text-indigo-700 px-3 py-1">Class {student?.class}-{student?.section}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="animate-fade-in">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Overall Score</p>
                <p className="text-2xl font-bold text-slate-800">{Math.round(perf?.overallScore || 0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Tests Taken</p>
                <p className="text-2xl font-bold text-slate-800">{student?.scores?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Best Score</p>
                <p className="text-2xl font-bold text-slate-800">
                  {Math.max(...(student?.scores?.map(s => s.score) || [0]))}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Latest Score</p>
                <p className="text-2xl font-bold text-slate-800">
                  {sortedScores[0] ? `${sortedScores[0].score}%` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Score Trend</h3>
                <p className="text-sm text-slate-500">Your recent performance</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="studentScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fill="url(#studentScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Subject Breakdown</h3>
                <p className="text-sm text-slate-500">Performance by subject</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} layout="vertical" barCategoryGap="30%">
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
                  <Tooltip 
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                  />
                  <Bar dataKey="score" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Test History
              </h3>
              <p className="text-sm text-slate-500">Your recent test results</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {sortedScores.map((score) => {
              const test = data.tests.find(t => t.id === score.testId);
              const gradeInfo = getGrade(score.score);
              
              return (
                <div key={score.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${getScoreBg(score.score)}`}>
                      <span className="text-lg font-bold">{score.score}</span>
                      <span className="text-[10px] font-medium">%</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{test?.title || 'Test'}</p>
                      <p className="text-sm text-slate-500">{test?.domain} • Chapter {test?.chapter}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <Badge className={`${getScoreBg(score.score)} mb-1`}>
                        Grade: {gradeInfo.grade}
                      </Badge>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(score.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
