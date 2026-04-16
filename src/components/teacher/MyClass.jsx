import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../../context/SchoolContext';
import {
  Users, Upload, BookOpen, TrendingUp, Award, AlertCircle,
  ChevronRight, Hash,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeColor(grade) {
  if (!grade) return 'text-slate-400';
  if (grade === 'A+' || grade === 'A') return 'text-emerald-600';
  if (grade === 'B+' || grade === 'B') return 'text-indigo-600';
  if (grade === 'C') return 'text-amber-600';
  return 'text-red-600';
}

function scoreBarColor(score) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-indigo-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-indigo-600' }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MyClass() {
  const { currentUser, data } = useSchool();
  const navigate = useNavigate();

  // Find the teacher record (has .classes array with { class, section, subject })
  const teacher = useMemo(
    () => data.teachers.find((t) => t.id === currentUser?.id),
    [data.teachers, currentUser?.id]
  );

  const assignments = teacher?.classes ?? [];

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = assignments[selectedIdx] ?? null;

  // Students in the selected class section
  const students = useMemo(() => {
    if (!selected) return [];
    return data.students
      .filter((s) => s.class === selected.class && s.section === selected.section)
      .sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0));
  }, [data.students, selected]);

  // For each student, derive their latest score + test title
  const testById = useMemo(
    () => Object.fromEntries((data.tests ?? []).map((t) => [t.id, t])),
    [data.tests]
  );

  const studentRows = useMemo(
    () =>
      students.map((s) => {
        const sorted = [...(s.scores ?? [])].sort(
          (a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0)
        );
        const latest = sorted[0] ?? null;
        const latestTest = latest ? testById[latest.testId] : null;
        return {
          ...s,
          latestScore: latest?.score ?? null,
          latestGrade: latest?.grade ?? null,
          latestTestTitle: latestTest?.title ?? '—',
          latestDate: latest?.date ? new Date(latest.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—',
        };
      }),
    [students, testById]
  );

  // Class stats
  const stats = useMemo(() => {
    const scored = studentRows.filter((s) => s.latestScore !== null);
    const avg = scored.length
      ? Math.round(scored.reduce((a, s) => a + s.latestScore, 0) / scored.length)
      : null;
    return { total: students.length, avg, scored: scored.length };
  }, [studentRows, students.length]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (assignments.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">No class assigned yet</h2>
        <p className="text-sm text-gray-500">
          Contact the school admin to get a class section assigned to you.
        </p>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {currentUser?.name ?? 'My Class'}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {teacher?.subject || currentUser?.subject || 'Teacher'} · {assignments.length} section{assignments.length !== 1 ? 's' : ''} assigned
        </p>
      </div>

      {/* Section pills */}
      <div className="flex flex-wrap gap-2">
        {assignments.map((cls, i) => (
          <button
            key={`${cls.class}-${cls.section}-${cls.subject}`}
            type="button"
            onClick={() => setSelectedIdx(i)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
              i === selectedIdx
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            Class {cls.class}-{cls.section}
            {cls.subject && <span className="ml-1.5 opacity-80">· {cls.subject}</span>}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Class stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              icon={Users}
              label="Students"
              value={stats.total}
              sub={`Class ${selected.class}-${selected.section}`}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Score"
              value={stats.avg !== null ? `${stats.avg}%` : '—'}
              sub={stats.scored > 0 ? `Based on ${stats.scored} evaluated` : 'No evaluations yet'}
              color={stats.avg !== null ? (stats.avg >= 70 ? 'text-emerald-600' : stats.avg >= 50 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}
            />
            <StatCard
              icon={BookOpen}
              label="Subject"
              value={selected.subject || teacher?.subject || '—'}
              sub="Assigned subject"
              color="text-purple-600"
            />
          </div>

          {/* Students table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Students — Class {selected.class}-{selected.section}
              </h3>
              <span className="text-xs text-gray-400">{students.length} enrolled</span>
            </div>

            {students.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No students enrolled in this section yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-slate-50">
                      <th className="px-5 py-3 font-medium">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          Roll
                        </div>
                      </th>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium hidden md:table-cell">Latest Test</th>
                      <th className="px-5 py-3 font-medium">Score</th>
                      <th className="px-5 py-3 font-medium">Grade</th>
                      <th className="px-5 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {studentRows.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">{s.rollNo || '—'}</td>
                        <td className="px-5 py-3">
                          <span className="font-medium text-gray-800">{s.name}</span>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <span className="text-gray-500 truncate max-w-[160px] block" title={s.latestTestTitle}>
                            {s.latestTestTitle}
                          </span>
                          {s.latestDate !== '—' && (
                            <span className="text-xs text-gray-400">{s.latestDate}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {s.latestScore !== null ? (
                            <div className="flex items-center gap-2 min-w-[80px]">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${scoreBarColor(s.latestScore)}`}
                                  style={{ width: `${s.latestScore}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-gray-700">{s.latestScore}%</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No score</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-sm font-bold ${gradeColor(s.latestGrade)}`}>
                            {s.latestGrade ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher/upload?rollNo=${s.rollNo}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Upload className="w-3 h-3" />
                            Upload Sheet
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
