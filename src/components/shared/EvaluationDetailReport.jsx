import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Pencil,
  Sparkles,
  Target,
  X,
} from 'lucide-react';

const cls = (...parts) => parts.filter(Boolean).join(' ');

function bandColor(ratio) {
  if (ratio >= 0.85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (ratio >= 0.6) return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  if (ratio >= 0.35) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function PillList({ items, tone = 'slate', icon: Icon }) {
  if (!Array.isArray(items) || !items.length) return null;
  const palette = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }[tone];
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item, idx) => (
        <li
          key={`${idx}-${typeof item === 'string' ? item.slice(0, 24) : idx}`}
          className={cls('text-xs px-2.5 py-1 rounded-full border flex items-center gap-1', palette)}
        >
          {Icon ? <Icon className="w-3 h-3" /> : null}
          <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function MasteryBar({ value }) {
  const pct = Math.max(0, Math.min(1, Number(value) || 0));
  const color = pct >= 0.75 ? 'bg-emerald-500' : pct >= 0.5 ? 'bg-indigo-500' : pct >= 0.3 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={cls('h-full transition-all', color)} style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  );
}

function QuestionCard({ q, onOverride, canOverride, hideModelAnswer }) {
  const [expanded, setExpanded] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [draftScore, setDraftScore] = useState(String(q.score ?? 0));
  const [draftReason, setDraftReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const ratio = q.max_score > 0 ? Number(q.score) / Number(q.max_score) : 0;
  const colour = bandColor(ratio);
  const fb = q.feedback || {};
  const isOverridden = q.teacher_override_score !== null && q.teacher_override_score !== undefined;

  const submitOverride = async () => {
    const numeric = Number(draftScore);
    if (!Number.isFinite(numeric)) {
      setErr('Score must be a number.');
      return;
    }
    if (numeric < 0 || numeric > Number(q.max_score)) {
      setErr(`Score must be between 0 and ${q.max_score}.`);
      return;
    }
    if (!draftReason.trim()) {
      setErr('Please add a short reason.');
      return;
    }
    setSaving(true);
    setErr('');
    const res = await onOverride({ newScore: numeric, reason: draftReason.trim() });
    setSaving(false);
    if (res?.error) {
      setErr(res.error);
      return;
    }
    setOverriding(false);
    setDraftReason('');
  };

  return (
    <div className={cls('border rounded-2xl p-4 space-y-3', colour)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{q.question_no}</span>
            {q.topic ? <span className="text-xs px-2 py-0.5 bg-white/70 rounded-full text-slate-700 border border-slate-200">{q.topic}</span> : null}
            {q.bloom_level ? <span className="text-[10px] uppercase tracking-wider text-slate-500">{q.bloom_level}</span> : null}
            {!q.student_answer_present ? (
              <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">Not attempted</span>
            ) : null}
            {q.needs_review ? (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Needs review
              </span>
            ) : null}
            {isOverridden ? (
              <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Teacher override
              </span>
            ) : null}
          </div>
          {q.question_text ? <p className="text-sm text-slate-700 mt-1">{q.question_text}</p> : null}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums">{Number(q.score).toFixed(q.score % 1 ? 1 : 0)}<span className="text-sm font-medium text-slate-500"> / {q.max_score}</span></div>
          {Number.isFinite(Number(q.semantic_similarity)) ? (
            <p className="text-[10px] text-slate-500">sim {Math.round(Number(q.semantic_similarity) * 100)}%</p>
          ) : null}
        </div>
      </div>

      {q.evaluator_reasoning ? (
        <p className="text-sm text-slate-700 italic">{q.evaluator_reasoning}</p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700 flex items-center gap-1">
            <Check className="w-3 h-3" /> Concepts you got
          </p>
          <PillList items={fb.key_concepts_present || q.strengths || []} tone="emerald" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-rose-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Concepts you missed
          </p>
          <PillList items={fb.missed_concepts || q.weaknesses || []} tone="rose" />
        </div>
      </div>

      {(fb.factual_errors?.length || fb.structural_issues?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fb.factual_errors?.length ? (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Factual errors
              </p>
              <PillList items={fb.factual_errors} tone="amber" />
            </div>
          ) : null}
          {fb.structural_issues?.length ? (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-700 flex items-center gap-1">
                <Target className="w-3 h-3" /> Structure
              </p>
              <PillList items={fb.structural_issues} tone="slate" />
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 flex items-center gap-1"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'Hide details' : 'Show student answer, exemplar & format guide'}
      </button>

      {expanded ? (
        <div className="space-y-3 pt-1 border-t border-white/60">
          {q.extracted_answer ? (
            <div className="bg-white/80 rounded-xl p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Your answer (OCR)</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{q.extracted_answer}</p>
            </div>
          ) : null}
          {!hideModelAnswer && q.model_answer ? (
            <div className="bg-white/80 rounded-xl p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Model answer</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{q.model_answer}</p>
            </div>
          ) : null}
          {fb.suggested_format ? (
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
              <p className="text-[11px] uppercase tracking-wider text-indigo-700 font-semibold mb-1 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> How to write this answer next time
              </p>
              <p className="text-sm text-indigo-900 whitespace-pre-wrap">{fb.suggested_format}</p>
            </div>
          ) : null}
          {fb.exemplar_answer ? (
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
              <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Exemplar full-marks answer
              </p>
              <p className="text-sm text-emerald-900 whitespace-pre-wrap">{fb.exemplar_answer}</p>
            </div>
          ) : null}
          {fb.improvement_areas?.length ? (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-700">Focus next on</p>
              <PillList items={fb.improvement_areas} tone="indigo" icon={Target} />
            </div>
          ) : null}
        </div>
      ) : null}

      {canOverride ? (
        <div className="pt-2 border-t border-white/60">
          {overriding ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">New score</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={q.max_score}
                    value={draftScore}
                    onChange={(e) => setDraftScore(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Reason (saved to audit log)</label>
                  <input
                    type="text"
                    value={draftReason}
                    onChange={(e) => setDraftReason(e.target.value)}
                    placeholder="e.g. answered correctly in different words"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>
              {err ? <p className="text-xs text-rose-600">{err}</p> : null}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={submitOverride}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save override'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverriding(false);
                    setErr('');
                  }}
                  className="px-3 py-1.5 bg-white text-slate-600 text-xs font-semibold rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftScore(String(q.score ?? 0));
                setOverriding(true);
              }}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Override score
            </button>
          )}
          {isOverridden && q.override_reason ? (
            <p className="text-[11px] text-slate-500 mt-1">
              Original AI score {q.original_ai_score}. Reason: {q.override_reason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PlanSection({ plan }) {
  if (!plan) return null;
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <BookOpenCheck className="w-4 h-4 text-indigo-600" />
        <h3 className="text-base font-semibold text-slate-900">Your improvement plan</h3>
      </div>
      {plan.plan_text ? <p className="text-sm text-slate-700 whitespace-pre-wrap">{plan.plan_text}</p> : null}

      {Array.isArray(plan.topic_breakdown) && plan.topic_breakdown.length ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Topic mastery</p>
          <div className="space-y-2">
            {plan.topic_breakdown.map((t, idx) => (
              <div key={`${idx}-${t.topic}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{t.topic}</span>
                  <span className="text-slate-500 tabular-nums">{Math.round((Number(t.mastery) || 0) * 100)}%</span>
                </div>
                <MasteryBar value={t.mastery} />
                {t.focus ? <p className="text-xs text-slate-500">{t.focus}</p> : null}
                {Array.isArray(t.missed) && t.missed.length ? (
                  <PillList items={t.missed.slice(0, 4)} tone="rose" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {Array.isArray(plan.tasks) && plan.tasks.length ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Next study tasks</p>
          <ul className="space-y-2">
            {plan.tasks.map((task, idx) => {
              const isStringTask = typeof task === 'string';
              return (
                <li key={idx} className="border border-slate-100 rounded-xl p-3 bg-slate-50/60">
                  {isStringTask ? (
                    <p className="text-sm text-slate-700">{task}</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{task.title}</p>
                        {task.est_minutes ? (
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">{task.est_minutes} min</span>
                        ) : null}
                      </div>
                      {task.why ? <p className="text-xs text-slate-500 mt-1">{task.why}</p> : null}
                      {task.how ? <p className="text-sm text-slate-700 mt-1">{task.how}</p> : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {Array.isArray(plan.weak_topics) && plan.weak_topics.length ? (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">Weak topics</p>
          <PillList items={plan.weak_topics} tone="amber" />
        </div>
      ) : null}
    </div>
  );
}

export default function EvaluationDetailReport({
  result,
  questions,
  plan,
  onOverride,
  canOverride = false,
  hideModelAnswer = false,
  onRequestRegrade,
  testTitle,
  studentLabel,
}) {
  const total = useMemo(() => {
    const obtained = (questions || []).reduce((a, q) => a + Number(q.score || 0), 0);
    const max = (questions || []).reduce((a, q) => a + Number(q.max_score || 0), 0);
    return { obtained, max, percentage: max > 0 ? Math.round((obtained / max) * 100) : Number(result?.percentage || 0) };
  }, [questions, result]);

  if (!result && !questions?.length) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100 text-sm text-slate-500">
        Evaluation not available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Evaluation report</p>
            <h2 className="text-xl font-semibold text-slate-900 mt-1">{testTitle || 'Test'}</h2>
            {studentLabel ? <p className="text-sm text-slate-500 mt-0.5">{studentLabel}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-indigo-700 tabular-nums">{total.obtained}<span className="text-base text-slate-400 font-medium"> / {total.max}</span></p>
            <p className="text-sm text-slate-500">{total.percentage}%</p>
          </div>
        </div>
        {onRequestRegrade ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={onRequestRegrade}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-800"
            >
              Re-grade with AI
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {(questions || []).map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            canOverride={canOverride}
            hideModelAnswer={hideModelAnswer}
            onOverride={(payload) => onOverride?.(q, payload)}
          />
        ))}
      </div>

      <PlanSection plan={plan} />
    </div>
  );
}
