import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import {
  Award,
  BookOpen,
  Calendar,
  GraduationCap,
  Hash,
  Mail,
  ScrollText,
  Sparkles,
  TrendingUp,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReportCard from './ReportCard';

const SCHOOL_LABEL = 'Madavi Institute';

const computeGrade = (score) => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  return 'D';
};

const bandLabel = (pct) => {
  if (pct >= 80) return { text: 'Excellent', className: 'bg-emerald-100 text-emerald-800' };
  if (pct >= 60) return { text: 'Good', className: 'bg-indigo-100 text-indigo-800' };
  if (pct >= 40) return { text: 'Satisfactory', className: 'bg-amber-100 text-amber-800' };
  return { text: 'Needs attention', className: 'bg-red-100 text-red-800' };
};

export default function StudentReportCardPage() {
  const { currentUser, data, getStudentPerformance } = useSchool();
  const [reportScore, setReportScore] = useState(null);

  const student = useMemo(() => {
    if (!currentUser) return null;
    return (
      data.students.find((s) => s.id === currentUser.id) ||
      data.students.find((s) => s.email === currentUser.email) ||
      null
    );
  }, [data.students, currentUser]);

  const perf = getStudentPerformance(student?.id || currentUser?.id);

  const sortedScores = useMemo(
    () => [...(student?.scores || [])].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [student]
  );

  const subjectRows = useMemo(() => {
    const sw = perf?.subjectWise || {};
    return Object.entries(sw)
      .map(([name, score]) => ({ name, score: Math.round(score) }))
      .sort((a, b) => b.score - a.score);
  }, [perf])

  const sessionLabel = useMemo(() => {
    const y = new Date().getFullYear();
    return `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
  }, []);

  const schoolName = currentUser?.schoolName || SCHOOL_LABEL;
  const overall = Math.round(perf?.overallScore || 0);
  const band = bandLabel(overall);

  if (!student) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Report card</h1>
          <p className="text-slate-500 mt-1">Academic summary and printable assessments</p>
        </div>
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-10 text-center text-slate-500">
            <GraduationCap className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="font-semibold text-slate-600">Student profile not linked</p>
            <p className="text-sm mt-2 max-w-md mx-auto">
              Once your school enrolls you with this account, your official report card will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <ScrollText className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Report card</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Academic summary</h1>
          <p className="text-slate-500 mt-1">
            Session {sessionLabel} · Consolidated view — open any row for a full printable report
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/student/performance"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Performance trends
            <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            to="/student/improvement"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Improvement plan
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Official header card */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-sm">
        <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiPjxwYXRoIGQ9Ik0zNiAzNGgyIi8+PC9nPjwvc3ZnPg==')]" />
        <div className="relative px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center ring-1 ring-white/25">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider">{schoolName}</p>
                  <p className="text-lg font-semibold truncate">Student progress report</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-white/10 px-2 py-1 text-indigo-100">Name</span>
                  <span className="font-semibold truncate">{student.name || currentUser?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-indigo-200" />
                  <span className="text-indigo-100">Roll</span>
                  <span className="font-mono font-semibold">{student.rollNo ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-200" />
                  <span className="text-indigo-100">Class</span>
                  <span className="font-semibold">{student.class}</span>
                </div>
                {currentUser?.email ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-indigo-200 shrink-0" />
                    <span className="truncate text-indigo-100/90">{currentUser.email}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 lg:items-center">
              <div className="rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 px-6 py-5 min-w-[140px]">
                <p className="text-xs text-indigo-200 mb-1">Overall average</p>
                <p className="text-4xl font-bold tabular-nums">{overall}%</p>
                <Badge className={`mt-2 ${band.className} border-0`}>{band.text}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                  <p className="text-indigo-200 text-xs">Tests recorded</p>
                  <p className="text-xl font-semibold tabular-nums">{sortedScores.length}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                  <p className="text-indigo-200 text-xs">Best score</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {sortedScores.length ? `${Math.max(...sortedScores.map((s) => s.score))}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subject snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-slate-900">Subject snapshot</h2>
            </div>
            {subjectRows.length === 0 ? (
              <p className="text-sm text-slate-500">No subject-level averages yet. Scores will roll up after tests are graded.</p>
            ) : (
              <ul className="space-y-3">
                {subjectRows.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-800 truncate">{row.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${Math.min(100, row.score)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-800 w-10 text-right">{row.score}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Highlights</h2>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="text-emerald-600 font-bold">·</span>
                <span>
                  {sortedScores.length > 0
                    ? `Latest assessment: ${sortedScores[0].score}% (${computeGrade(sortedScores[0].score)})`
                    : 'No graded tests yet — your teacher will publish scores here.'}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-600 font-bold">·</span>
                <span>Detailed AI feedback and topic breakdown are available in each printable report below.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 font-bold">·</span>
                <span>Use “Download PDF” inside a report for a parent-ready copy.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Transcript-style table */}
      <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Assessment record</h2>
          </div>
          <Badge variant="outline" className="text-xs font-normal text-slate-600 border-slate-200">
            {sortedScores.length} {sortedScores.length === 1 ? 'entry' : 'entries'}
          </Badge>
        </div>
        <CardContent className="p-0">
          {sortedScores.length === 0 ? (
            <div className="px-6 py-14 text-center text-slate-500 text-sm">
              No assessments on file yet. Check back after your teacher evaluates your tests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3 font-semibold">Assessment</th>
                    <th className="px-6 py-3 font-semibold hidden sm:table-cell">Domain / focus</th>
                    <th className="px-6 py-3 font-semibold hidden md:table-cell">Date</th>
                    <th className="px-6 py-3 font-semibold text-right">Score</th>
                    <th className="px-6 py-3 font-semibold text-right hidden sm:table-cell">Grade</th>
                    <th className="px-6 py-3 font-semibold text-right w-[140px]">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedScores.map((sc) => {
                    const test = data.tests.find((t) => t.id === sc.testId);
                    const grade = sc.grade || computeGrade(sc.score);
                    return (
                      <tr key={sc.id} className="bg-white hover:bg-slate-50/80">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{test?.title || 'Test'}</p>
                          {test?.chapter != null && (
                            <p className="text-xs text-slate-500 mt-0.5">Chapter {test.chapter}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 hidden sm:table-cell">
                          {test?.domain || '—'}
                        </td>
                        <td className="px-6 py-4 text-slate-500 hidden md:table-cell whitespace-nowrap">
                          {sc.date
                            ? new Date(sc.date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold tabular-nums text-slate-900">
                          {sc.score}%
                        </td>
                        <td className="px-6 py-4 text-right hidden sm:table-cell">
                          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                            {grade}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => setReportScore(sc)}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-slate-400 pb-2">
        Figures reflect evaluations recorded in EvalAI. For queries, contact your class teacher or school office.
      </p>

      <Dialog open={Boolean(reportScore)} onOpenChange={(open) => !open && setReportScore(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-500" />
              Printable report card
            </DialogTitle>
          </DialogHeader>
          {reportScore &&
            (() => {
              const test = data.tests.find((t) => t.id === reportScore.testId);
              return <ReportCard student={student} test={test} evaluation={reportScore} />;
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
