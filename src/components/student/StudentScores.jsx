import { useMemo, useState, createElement } from 'react';
import { useSchool } from '../../context/SchoolContext';
import {
  FileText, TrendingUp, Target, Award, Clock,
  Sparkles, TrendingDown, Star, BookOpen, User, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import ReportCard from './ReportCard';

const ScoreTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg text-sm shadow-lg border border-slate-200">
        <p className="font-medium text-slate-800">{payload[0].payload.name}</p>
        <p className="text-indigo-600 font-semibold">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const getScoreBg = (score) => {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

const computeGrade = (score) => {
  if (score >= 90) return { grade: 'A+', color: 'text-emerald-600' };
  if (score >= 80) return { grade: 'A',  color: 'text-emerald-600' };
  if (score >= 70) return { grade: 'B+', color: 'text-blue-600' };
  if (score >= 60) return { grade: 'B',  color: 'text-blue-600' };
  if (score >= 50) return { grade: 'C',  color: 'text-amber-600' };
  return              { grade: 'D',  color: 'text-red-600' };
};

export default function StudentScores() {
  const { currentUser, data, getStudentPerformance } = useSchool();
  const [reportCardScore, setReportCardScore] = useState(null); // score record to show in modal

  // Student can be matched by id (real Supabase user) or fallback to email
  const student = useMemo(() => {
    if (!currentUser) return null;
    return (
      data.students.find(s => s.id === currentUser.id) ||
      data.students.find(s => s.email === currentUser.email) ||
      null
    );
  }, [data.students, currentUser]);

  const perf = getStudentPerformance(student?.id || currentUser?.id);

  const sortedScores = useMemo(
    () => [...(student?.scores || [])].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [student]
  );

  const chartData = useMemo(
    () => sortedScores.slice(0, 8).reverse().map(sc => {
      const test = data.tests.find(t => t.id === sc.testId);
      return { name: test?.title?.split(' ').slice(0, 2).join(' ') || 'Test', score: sc.score };
    }),
    [sortedScores, data.tests]
  );

  const subjectData = useMemo(
    () => Object.entries(perf?.subjectWise || {}).map(([name, score]) => ({
      name: name.length > 10 ? name.slice(0, 10) + '…' : name,
      score: Math.round(score),
    })),
    [perf]
  );

  // Feedback from scores rows (set when teacher uploads + evaluates)
  const evaluationFeedback = useMemo(() => {
    return sortedScores
      .filter(sc => sc.feedback || sc.grade)
      .map(sc => {
        const test = data.tests.find(t => t.id === sc.testId);
        const topics = test?.topics || [];
        const topicScores = sc.topicScores || {};
        return {
          testTitle: test?.title || 'Test',
          testId: sc.testId,
          score: sc.score,
          grade: sc.grade || computeGrade(sc.score).grade,
          feedback: sc.feedback || '',
          weakTopics:   topics.filter(t => (topicScores[t] || 0) < 65 && topicScores[t] != null),
          strongTopics: topics.filter(t => (topicScores[t] || 0) >= 80),
          date: sc.date,
        };
      });
  }, [sortedScores, data.tests]);

  const bestScore = sortedScores.length > 0 ? Math.max(...sortedScores.map(s => s.score)) : 0;

  // ── No student record yet ────────────────────────────────────────────────
  if (!student) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {currentUser?.name}!</h1>
          <p className="text-slate-500 mt-1">Your academic results and AI feedback</p>
        </div>
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
          <User className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="font-semibold text-slate-600">Your student profile is not set up yet</p>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            Ask your school admin to enroll you with the correct email address, or link your account via the Supabase dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {currentUser?.name}!</h1>
          <p className="text-slate-500 mt-1">Your academic results and AI feedback</p>
        </div>
        <Badge className="bg-indigo-100 text-indigo-700 px-3 py-1">
          Class {student.class} &nbsp;·&nbsp; Roll #{student.rollNo || '—'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Score', value: `${Math.round(perf?.overallScore || 0)}%`, icon: TrendingUp,  color: 'bg-amber-100 text-amber-600' },
          { label: 'Tests Taken',   value: sortedScores.length,                         icon: FileText,   color: 'bg-indigo-100 text-indigo-600' },
          { label: 'Best Score',    value: sortedScores.length ? `${bestScore}%` : '—', icon: Target,     color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Latest Score',  value: sortedScores[0] ? `${sortedScores[0].score}%` : '—', icon: Award, color: 'bg-purple-100 text-purple-600' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  {createElement(icon, { className: 'w-5 h-5' })}
                </div>
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <h3 className="text-base font-semibold text-slate-800">Score Trend</h3>
            <p className="text-xs text-slate-500">Your recent performance</p>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="studentScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                    <Tooltip content={<ScoreTooltip />} />
                    <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fill="url(#studentScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 text-sm">No test scores yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-base font-semibold text-slate-800">By Subject</h3>
            <p className="text-xs text-slate-500">Performance breakdown</p>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {subjectData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectData} layout="vertical" barCategoryGap="30%">
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={60} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                    />
                    <Bar dataKey="score" fill="#6366f1" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 text-sm">No subject data yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Evaluation Feedback — each card has a "View Report Card" button */}
      {evaluationFeedback.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-800">AI Feedback</h2>
            <Badge className="bg-indigo-100 text-indigo-700 text-xs">
              {evaluationFeedback.length} {evaluationFeedback.length === 1 ? 'report' : 'reports'}
            </Badge>
          </div>

          {evaluationFeedback.map((fb, idx) => {
            const scoreRecord = sortedScores.find(sc => sc.testId === fb.testId);
            return (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{fb.testTitle}</p>
                      {fb.date && (
                        <p className="text-xs text-slate-400">
                          {new Date(fb.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${getScoreBg(fb.score)}`}>
                      {fb.score}% &nbsp;·&nbsp; {fb.grade}
                    </div>
                    {scoreRecord && (
                      <button
                        type="button"
                        onClick={() => setReportCardScore(scoreRecord)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Report Card
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {fb.feedback && (
                    <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl">
                      <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-700 leading-relaxed">{fb.feedback}</p>
                    </div>
                  )}

                  {(fb.weakTopics.length > 0 || fb.strongTopics.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fb.weakTopics.length > 0 && (
                        <div className="bg-red-50 rounded-xl p-4">
                          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5" /> Areas to Improve
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {fb.weakTopics.map((t, i) => (
                              <span key={i} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {fb.strongTopics.length > 0 && (
                        <div className="bg-emerald-50 rounded-xl p-4">
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5" /> Strong Areas
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {fb.strongTopics.map((t, i) => (
                              <span key={i} className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No feedback placeholder */}
      {evaluationFeedback.length === 0 && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Sparkles className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="font-medium text-slate-500">No AI feedback yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Feedback will appear here once your teacher uploads and evaluates your answer sheet.
          </p>
        </div>
      )}

      {/* Report Card modal */}
      <Dialog open={!!reportCardScore} onOpenChange={(open) => !open && setReportCardScore(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-base">Report Card</DialogTitle>
          </DialogHeader>
          {reportCardScore && (() => {
            const test = data.tests.find(t => t.id === reportCardScore.testId);
            return (
              <ReportCard
                student={student}
                test={test}
                evaluation={reportCardScore}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Test History */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Test History
          </h3>
          <p className="text-xs text-slate-500">All your test results</p>
        </CardHeader>
        <CardContent className="p-0">
          {sortedScores.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No tests taken yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedScores.map(score => {
                const test = data.tests.find(t => t.id === score.testId);
                const gradeInfo = score.grade
                  ? { grade: score.grade, color: 'text-indigo-600' }
                  : computeGrade(score.score);
                return (
                  <div key={score.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${getScoreBg(score.score)}`}>
                        <span className="text-lg font-bold">{score.score}</span>
                        <span className="text-[10px] font-medium">%</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{test?.title || 'Test'}</p>
                        <p className="text-xs text-slate-500">
                          {test?.domain && `${test.domain} · `}
                          {test?.chapter ? `Chapter ${test.chapter}` : ''}
                        </p>
                        {score.feedback && (
                          <p className="text-xs text-indigo-500 mt-0.5 italic line-clamp-1">{score.feedback}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge className={`${getScoreBg(score.score)}`}>
                        Grade: <span className={`font-bold ml-1 ${gradeInfo.color}`}>{gradeInfo.grade}</span>
                      </Badge>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {score.date ? new Date(score.date).toLocaleDateString() : '—'}
                      </p>
                      {(score.feedback || score.grade) && (
                        <button
                          type="button"
                          onClick={() => setReportCardScore(score)}
                          className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Report Card"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
