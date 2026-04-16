/**
 * ReportCard.jsx
 * Branded, printable report card for a single test evaluation.
 *
 * Props:
 *   student    { id, name, class, section, rollNo }
 *   test       { id, title, domain?, chapter?, topics? }
 *   evaluation { score, grade, feedback, topicScores, details? }
 *              `details` is the rich RCA object from evaluations.details (optional)
 */
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Download, TrendingUp, TrendingDown, Award, BookOpen } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeColor(grade) {
  if (grade === 'A+' || grade === 'A')   return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' };
  if (grade === 'B+' || grade === 'B')   return { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300' };
  if (grade === 'C')                      return { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300' };
  return                                         { bg: 'bg-red-100',    text: 'text-red-700',     border: 'border-red-300' };
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function scoreBarWidth(score) {
  return `${Math.min(100, Math.max(0, score))}%`;
}

function topicRowColor(score) {
  if (score >= 80) return 'bg-emerald-50';
  if (score >= 60) return 'bg-slate-50';
  return 'bg-red-50';
}

function topicScoreColor(score) {
  if (score >= 80) return 'text-emerald-700 font-bold';
  if (score >= 60) return 'text-slate-700';
  return 'text-red-600 font-bold';
}

// Derive RCA from topicScores when rich details aren't available
function deriveRCA(topicScores = {}) {
  const entries = Object.entries(topicScores);
  const weak   = entries.filter(([, s]) => s < 60).map(([topic, score]) => ({ topic, score }));
  const strong = entries.filter(([, s]) => s >= 80).map(([topic, score]) => ({ topic, score }));
  return { weak, strong };
}

function deriveImprovementPlan(weakTopics = []) {
  if (weakTopics.length === 0) {
    return [
      'Continue your strong performance with regular revision.',
      'Try advanced practice questions to challenge yourself.',
      'Attempt a timed mock test to maintain exam readiness.',
    ];
  }
  return [
    `Re-read your textbook section on "${weakTopics[0]?.topic ?? weakTopics[0]}" and make concise revision notes.`,
    `Attempt 10 practice questions daily on "${weakTopics[1]?.topic ?? weakTopics[0]?.topic ?? 'weak topics'}" until confident.`,
    'Take a full timed mock test after completing topic-wise revision.',
  ];
}

// ─── Inner printable body (no hooks — must be forwardRef or plain div) ────────

function ReportCardBody({ student, test, evaluation, generatedAt }) {
  const { score, grade, feedback, topicScores = {}, details } = evaluation;
  const gc = gradeColor(grade);

  // Use rich details if available, otherwise derive from topicScores
  const perQuestionScores = details?.perQuestionScores ?? null;
  const rca = details?.topicRCA ?? deriveRCA(topicScores);
  const improvementPlan = details?.improvementPlan ?? deriveImprovementPlan(rca.weak);
  const hasTopicData = Object.keys(topicScores).length > 0 || (perQuestionScores?.length ?? 0) > 0;

  const testDate = evaluation.date
    ? new Date(evaluation.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      className="bg-white font-sans text-slate-800"
      style={{ width: '794px', minHeight: '1123px', margin: '0 auto' }}
    >
      {/* ── Header band ─────────────────────────────────────────────────────── */}
      <div
        className="px-10 py-8 text-white"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">Madavi Institute</span>
            </div>
            <p className="text-indigo-200 text-xs">AI-Powered Evaluation System</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tracking-wide">STUDENT REPORT CARD</p>
            <p className="text-indigo-200 text-xs mt-1">Generated {generatedAt}</p>
          </div>
        </div>
      </div>

      {/* ── Student info row ─────────────────────────────────────────────────── */}
      <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {initials(student?.name)}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{student?.name ?? '—'}</p>
            <p className="text-sm text-slate-500">
              Class {student?.class}-{student?.section} &nbsp;·&nbsp; Roll No. {student?.rollNo ?? '—'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-700">{test?.title ?? '—'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{testDate}</p>
          {test?.domain && <p className="text-xs text-slate-400">{test.domain}</p>}
        </div>
      </div>

      {/* ── Score hero ───────────────────────────────────────────────────────── */}
      <div className="px-10 py-8">
        <div className="flex items-center gap-8">
          {/* Big score number */}
          <div className="text-center">
            <p className="text-6xl font-black text-slate-900 leading-none">{score}</p>
            <p className="text-lg text-slate-400 font-medium">/ 100</p>
          </div>

          {/* Grade badge */}
          <div className={`w-20 h-20 rounded-2xl border-2 ${gc.border} ${gc.bg} flex flex-col items-center justify-center`}>
            <span className={`text-3xl font-black ${gc.text}`}>{grade}</span>
            <span className="text-xs text-slate-500 mt-0.5">Grade</span>
          </div>

          {/* Progress bar */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Overall Performance</span>
              <span className="text-sm font-semibold text-slate-700">{score}%</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-indigo-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: scoreBarWidth(score) }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-slate-400">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-question breakdown or topic scores ───────────────────────────── */}
      {perQuestionScores && perQuestionScores.length > 0 && (
        <div className="px-10 pb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Question-wise Breakdown</p>
          <table className="w-full text-sm border border-slate-100 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">Q#</th>
                <th className="px-4 py-2.5 font-medium">Topic</th>
                <th className="px-4 py-2.5 font-medium text-right">Scored / Max</th>
                <th className="px-4 py-2.5 font-medium">Remark</th>
              </tr>
            </thead>
            <tbody>
              {perQuestionScores.map(({ q, topic, max, scored, remark }) => {
                const ratio = scored / max;
                const rowBg = ratio >= 0.85 ? 'bg-emerald-50' : ratio >= 0.65 ? '' : ratio >= 0.45 ? 'bg-amber-50/60' : 'bg-red-50';
                const scoreCol = ratio >= 0.85 ? 'text-emerald-700 font-bold' : ratio >= 0.65 ? 'text-indigo-700 font-semibold' : ratio >= 0.45 ? 'text-amber-700 font-semibold' : 'text-red-700 font-bold';
                return (
                  <tr key={q} className={`border-t border-slate-100 ${rowBg}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{q}</td>
                    <td className="px-4 py-2.5 text-slate-700">{topic}</td>
                    <td className={`px-4 py-2.5 text-right ${scoreCol}`}>{scored} / {max}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{remark}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Topic scores (when no perQuestionScores but topicScores available) */}
      {!perQuestionScores && hasTopicData && Object.entries(topicScores).length > 0 && (
        <div className="px-10 pb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Topic-wise Performance</p>
          <div className="space-y-2">
            {Object.entries(topicScores).map(([topic, ts]) => (
              <div key={topic} className={`flex items-center gap-3 p-3 rounded-xl ${topicRowColor(ts)}`}>
                <span className="flex-1 text-sm text-slate-700">{topic}</span>
                <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ts >= 80 ? 'bg-emerald-500' : ts >= 60 ? 'bg-indigo-500' : 'bg-red-500'}`}
                    style={{ width: `${ts}%` }}
                  />
                </div>
                <span className={`text-sm w-12 text-right ${topicScoreColor(ts)}`}>{ts}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Topic RCA ────────────────────────────────────────────────────────── */}
      {(rca.weak.length > 0 || rca.strong.length > 0) && (
        <div className="px-10 pb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Root Cause Analysis</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Areas to Improve</p>
              </div>
              {rca.weak.length === 0 ? (
                <p className="text-xs text-slate-400 italic">None — great work!</p>
              ) : (
                <ul className="space-y-2">
                  {rca.weak.map(({ topic, score: ts, reason }) => (
                    <li key={topic} className="text-xs">
                      <span className="font-semibold text-red-700">{topic}</span>
                      {ts !== undefined && <span className="text-red-400 ml-1">({ts}%)</span>}
                      {reason && <p className="text-red-500 mt-0.5 leading-relaxed">{reason}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Strengths</p>
              </div>
              {rca.strong.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Keep practising to build strengths.</p>
              ) : (
                <ul className="space-y-2">
                  {rca.strong.map(({ topic, score: ts, reason }) => (
                    <li key={topic} className="text-xs">
                      <span className="font-semibold text-emerald-700">{topic}</span>
                      {ts !== undefined && <span className="text-emerald-400 ml-1">({ts}%)</span>}
                      {reason && <p className="text-emerald-600 mt-0.5 leading-relaxed">{reason}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Improvement plan ─────────────────────────────────────────────────── */}
      <div className="px-10 pb-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Improvement Plan</p>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <ol className="space-y-2">
            {improvementPlan.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Teacher feedback callout ─────────────────────────────────────────── */}
      {feedback && (
        <div className="px-10 pb-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Teacher Feedback</p>
          <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-5 pl-8">
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            />
            <Award className="absolute right-4 top-4 w-4 h-4 text-indigo-200" />
            <p className="text-sm text-slate-700 leading-relaxed italic">"{feedback}"</p>
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div
        className="px-10 py-5 mt-auto border-t border-slate-100 flex items-center justify-between"
        style={{ background: '#f8f9ff' }}
      >
        <p className="text-xs text-slate-400">
          Generated by <span className="font-semibold text-indigo-600">Madavi Institute AI Evaluation System</span>
        </p>
        <p className="text-xs text-slate-300">Confidential — For student and parent use only</p>
      </div>
    </div>
  );
}

// ─── Exported wrapper (has hooks + print button) ──────────────────────────────

export default function ReportCard({ student, test, evaluation }) {
  const printRef = useRef(null);
  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ReportCard_Roll${student?.rollNo ?? ''}_${(test?.title ?? 'Test').replace(/\s+/g, '_')}`,
  });

  return (
    <div>
      {/* Print action bar — hidden on print */}
      <div className="no-print flex items-center justify-between mb-4 px-1">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {test?.title ?? 'Test'} — {student?.name ?? 'Student'}
          </p>
          <p className="text-xs text-slate-400">Roll #{student?.rollNo ?? '—'} · Class {student?.class}-{student?.section}</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Printable area */}
      <div ref={printRef} className="report-card-print-root overflow-auto">
        <ReportCardBody
          student={student}
          test={test}
          evaluation={evaluation}
          generatedAt={generatedAt}
        />
      </div>
    </div>
  );
}
