import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, Upload, AlertCircle, CheckCircle2, Clock3, FileText } from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { supabase } from '../../lib/supabaseClient';
import EvaluationDetailReport from '../shared/EvaluationDetailReport';
import { runLocalEvaluation, isLocalEvaluatorEnabled } from '../../services/localEvaluator';

const LOCAL_MODE = isLocalEvaluatorEnabled();

const MAX_BYTES = parseInt(import.meta.env.VITE_UPLOAD_MAX_BYTES || '10485760', 10);
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain'];

function StatusBadge({ value }) {
  const v = String(value || '').toLowerCase();
  const styles =
    v === 'done'
      ? 'bg-emerald-100 text-emerald-700'
      : v === 'failed'
        ? 'bg-red-100 text-red-700'
        : v === 'ocr' || v === 'grading' || v === 'plan'
          ? 'bg-indigo-100 text-indigo-700'
          : 'bg-amber-100 text-amber-700';
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles}`}>{v || 'unknown'}</span>;
}

export default function AIEvaluationWorkbench() {
  const {
    data,
    getCurrentTeacherId,
    getTeacherAssignedStudents,
    submitAIEvaluationJob,
    getAIEvaluationJob,
    listMyAIEvaluationJobs,
    getEvaluationDetail,
    overrideAIQuestionScore,
    requestAIRegrade,
  } = useSchool();

  const teacherId = getCurrentTeacherId();
  const assignedStudents = useMemo(
    () => (teacherId ? getTeacherAssignedStudents(teacherId) : []),
    [teacherId, getTeacherAssignedStudents]
  );
  const classOptions = useMemo(
    () =>
      [...new Set(assignedStudents.map((s) => s.class))]
        .filter((n) => Number.isFinite(Number(n)))
        .sort((a, b) => Number(a) - Number(b)),
    [assignedStudents]
  );

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [questionPaperFile, setQuestionPaperFile] = useState(null);
  const [answerKeyFile, setAnswerKeyFile] = useState(null);
  const [studentAnswerFile, setStudentAnswerFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState('');
  const [activeJob, setActiveJob] = useState(null);
  const [evaluation, setEvaluation] = useState({ result: null, questions: [], plan: null });
  const [recentJobs, setRecentJobs] = useState([]);
  const [ocrArtifact, setOcrArtifact] = useState(null);
  const [llmArtifact, setLlmArtifact] = useState(null);
  const [overrideError, setOverrideError] = useState('');
  const [localStatus, setLocalStatus] = useState('');
  const [localMeta, setLocalMeta] = useState(null);
  const pollingRef = useRef(null);

  const effectiveSelectedClass = selectedClass || (classOptions.length ? String(classOptions[0]) : '');

  const studentsInClass = useMemo(
    () =>
      assignedStudents
        .filter((s) => String(s.class) === String(effectiveSelectedClass))
        .sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0)),
    [assignedStudents, effectiveSelectedClass]
  );

  const testsForClass = useMemo(() => {
    const cls = data.schoolClasses.find((c) => String(c.class) === String(effectiveSelectedClass));
    if (!cls?.id) return [];
    return (data.tests || []).filter((t) => t.class_id === cls.id || t.classId === cls.id);
  }, [data.schoolClasses, data.tests, effectiveSelectedClass]);

  const effectiveSelectedTestId = selectedTestId || (testsForClass.length ? testsForClass[0].id : '');

  const selectedClassId = useMemo(() => {
    return data.schoolClasses.find((c) => String(c.class) === String(effectiveSelectedClass))?.id || null;
  }, [data.schoolClasses, effectiveSelectedClass]);

  const validateFile = (file) => {
    if (!file) return '';
    if (file.size > MAX_BYTES) return `File ${file.name} exceeds ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`;
    if (file.type && !ALLOWED_TYPES.includes(file.type)) return `${file.name}: unsupported file type.`;
    return '';
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const rows = await listMyAIEvaluationJobs({ limit: 15 });
      if (mounted) setRecentJobs(rows);
    })();
    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadArtifactJson = async (path) => {
    if (!supabase || !path) return null;
    const { data, error } = await supabase.storage.from('answer-sheets').download(path);
    if (error || !data) return null;
    const text = await data.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const refreshJobDetails = async (jobId) => {
    if (!jobId) return;
    const job = await getAIEvaluationJob(jobId);
    setActiveJob(job);
    if (!job) return;

    if (job.result_id) {
      const detail = await getEvaluationDetail(job.result_id);
      if (detail) setEvaluation(detail);
      const [ocrJson, llmJson] = await Promise.all([
        loadArtifactJson(job.raw_ocr_path),
        loadArtifactJson(job.raw_llm_path),
      ]);
      setOcrArtifact(ocrJson);
      setLlmArtifact(llmJson);
    } else {
      setEvaluation({ result: null, questions: [], plan: null });
      setOcrArtifact(null);
      setLlmArtifact(null);
    }
  };

  useEffect(() => {
    if (!activeJobId) return;
    (async () => {
      await refreshJobDetails(activeJobId);
    })();
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    pollingRef.current = window.setInterval(async () => {
      const job = await getAIEvaluationJob(activeJobId);
      setActiveJob(job);
      if (job?.result_id) {
        const detail = await getEvaluationDetail(job.result_id);
        if (detail) setEvaluation(detail);
        const [ocrJson, llmJson] = await Promise.all([
          loadArtifactJson(job.raw_ocr_path),
          loadArtifactJson(job.raw_llm_path),
        ]);
        setOcrArtifact(ocrJson);
        setLlmArtifact(llmJson);
      }
      if (!job || job.status === 'done' || job.status === 'failed') {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
        const rows = await listMyAIEvaluationJobs({ limit: 15 });
        setRecentJobs(rows);
      }
    }, 3000);
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOverride = async (question, payload) => {
    setOverrideError('');
    const res = await overrideAIQuestionScore(question.id, payload);
    if (res?.error) {
      setOverrideError(res.error);
      return res;
    }
    if (activeJob?.result_id) {
      const detail = await getEvaluationDetail(activeJob.result_id);
      if (detail) setEvaluation(detail);
    }
    return res;
  };

  const handleRegrade = async () => {
    const submissionId = activeJob?.answer_submissions?.id || activeJob?.submission_id;
    if (!submissionId) return;
    setOverrideError('');
    const res = await requestAIRegrade(submissionId, { parentJobId: activeJob.id });
    if (res?.error) {
      setOverrideError(res.error);
      return;
    }
    if (res.jobId) setActiveJobId(res.jobId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const fileErrors = [questionPaperFile, answerKeyFile, studentAnswerFile].map(validateFile).filter(Boolean);
    if (fileErrors.length) {
      setError(fileErrors[0]);
      return;
    }
    if (!selectedClassId || !selectedStudentId || !effectiveSelectedTestId || !studentAnswerFile) {
      setError('Please select class, student, test, and upload student answer sheet.');
      return;
    }

    if (LOCAL_MODE) {
      setSubmitting(true);
      setLocalStatus('Starting...');
      setLocalMeta(null);
      setEvaluation({ result: null, questions: [], plan: null });
      try {
        const body = await runLocalEvaluation({
          questionPaperFile,
          answerKeyFile,
          studentAnswerFile,
          onProgress: (p) => {
            if (p.stage && !p.page) setLocalStatus(p.stage);
            else if (p.stage === 'ocr-recognize') setLocalStatus(`OCR'ing ${p.file || 'file'} page ${p.page} of ${p.total}...`);
            else if (p.stage === 'ocr-progress') setLocalStatus(`OCR'ing... ${p.progress}%`);
            else if (p.stage === 'ocr-init') setLocalStatus(`Loading OCR engine (Hindi + English)...`);
            else if (p.stage === 'ocr-render') setLocalStatus(`Rendering ${p.file || 'page'} ${p.page} of ${p.total}...`);
          },
        });
        setEvaluation({ result: body.result, questions: body.questions, plan: body.plan });
        setLocalMeta({
          elapsedMs: body.elapsedMs,
          embeddingsAvailable: body.embeddingsAvailable,
          degraded: body.degraded,
          inputWarnings: body.inputWarnings || [],
          noReference: body.noReference || false,
        });
        setActiveJob({ id: 'local', status: 'done' });
        setLocalStatus('');
        setQuestionPaperFile(null);
        setAnswerKeyFile(null);
        setStudentAnswerFile(null);
      } catch (err) {
        setError(err?.message || 'Local evaluation failed.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    const res = await submitAIEvaluationJob({
      testId: effectiveSelectedTestId,
      classId: selectedClassId,
      studentId: selectedStudentId,
      questionPaperFile,
      answerKeyFile,
      studentAnswerFile,
    });
    setSubmitting(false);

    if (res?.error) {
      setError(res.error);
      return;
    }
    setActiveJobId(res.jobId || '');
    setQuestionPaperFile(null);
    setAnswerKeyFile(null);
    setStudentAnswerFile(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">AI Evaluation Workbench</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload question paper, key answer, and student answer sheet to run OCR + LLM grading.
        </p>
      </div>

      {LOCAL_MODE ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-xs text-indigo-900 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Local AI evaluation pipeline active</p>
            <p className="mt-0.5 text-indigo-800">
              Files are processed by the local Node server (Sarvam chat + on-device multilingual embeddings). Nothing is saved to Supabase.
              To switch to the production pipeline, set <code className="bg-white/70 px-1 py-0.5 rounded">VITE_USE_LOCAL_EVALUATOR=false</code> in <code className="bg-white/70 px-1 py-0.5 rounded">.env</code> and apply migration 038 + deploy the edge function.
            </p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
            <select
              value={effectiveSelectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedStudentId('');
              }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              {classOptions.map((c) => (
                <option key={c} value={String(c)}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">Select student</option>
              {studentsInClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · roll {s.rollNo ?? '-'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Test</label>
            <select
              value={effectiveSelectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">Select test</option>
              {testsForClass.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FileUploadInput label="Question Paper (optional)" file={questionPaperFile} setFile={setQuestionPaperFile} />
          <FileUploadInput label="Answer Key (optional)" file={answerKeyFile} setFile={setAnswerKeyFile} />
          <FileUploadInput label="Student Answer (required)" file={studentAnswerFile} setFile={setStudentAnswerFile} />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {submitting ? 'Submitting job...' : 'Run AI Evaluation'}
        </button>
      </form>

      {submitting && LOCAL_MODE && localStatus ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex items-center gap-3 text-sm text-indigo-900">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{localStatus}</span>
        </div>
      ) : null}

      {activeJob && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{LOCAL_MODE ? 'Latest evaluation' : 'Active Job'}</h3>
              {!LOCAL_MODE ? <p className="text-xs text-slate-500">Job ID: {activeJob.id}</p> : null}
            </div>
            <StatusBadge value={activeJob.status} />
          </div>

          {activeJob.error_message ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{activeJob.error_message}</div>
          ) : null}

          {overrideError ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{overrideError}</div>
          ) : null}

          {LOCAL_MODE && localMeta?.noReference ? (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-sm text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> No valid reference answer key</p>
              <p className="text-xs text-amber-800">
                {(localMeta.inputWarnings || []).includes('answer_key_unrelated') ? "The answer key is on a different topic than the question paper." : "The answer key was empty or unreadable."}
                {' '}AI graded each answer using only the question and its subject knowledge. All scores are flagged for teacher review.
              </p>
            </div>
          ) : null}

          {LOCAL_MODE && localMeta ? (
            <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
              <span>Completed in {(localMeta.elapsedMs / 1000).toFixed(1)}s</span>
              <span className={localMeta.embeddingsAvailable ? 'text-emerald-700' : 'text-amber-700'}>
                Semantic similarity: {localMeta.embeddingsAvailable ? 'enabled (multilingual embeddings)' : 'disabled'}
              </span>
              {localMeta.degraded && !localMeta.noReference ? <span className="text-amber-700">degraded mode</span> : null}
            </div>
          ) : null}

          {evaluation.questions.length > 0 ? (
            <EvaluationDetailReport
              result={evaluation.result}
              questions={evaluation.questions}
              plan={evaluation.plan}
              canOverride={!LOCAL_MODE}
              hideModelAnswer={false}
              onOverride={LOCAL_MODE ? undefined : handleOverride}
              onRequestRegrade={!LOCAL_MODE && activeJob.status === 'done' ? handleRegrade : undefined}
              testTitle={data.tests?.find((t) => t.id === evaluation.result?.test_id)?.title}
            />
          ) : null}

          {(ocrArtifact || llmArtifact) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-800">OCR and Evaluation Artifacts</h4>
              {ocrArtifact?.answerKeyText || ocrArtifact?.studentText ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Extracted Answer Key</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap max-h-44 overflow-auto">
                      {ocrArtifact.answerKeyText || 'No key text extracted.'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Extracted Student Answer</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap max-h-44 overflow-auto">
                      {ocrArtifact.studentText || 'No student text extracted.'}
                    </p>
                  </div>
                </div>
              ) : null}
              {Array.isArray(llmArtifact?.rows) ? (
                <p className="text-xs text-slate-500">
                  Model output persisted. {llmArtifact.rows.length} question judgments recorded.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Clock3 className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Recent AI Jobs</h3>
        </div>
        {recentJobs.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No AI jobs yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentJobs.map((j) => (
              <button
                type="button"
                key={j.id}
                onClick={() => setActiveJobId(j.id)}
                className="w-full flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2 hover:bg-slate-50 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">{j.id.slice(0, 8)}...</p>
                  <p className="text-xs text-slate-500">{new Date(j.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {j.result_id ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Upload className="w-4 h-4 text-slate-400" />}
                  <StatusBadge value={j.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FileUploadInput({ label, file, setFile }) {
  return (
    <label className="block border border-dashed border-gray-300 rounded-xl p-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.txt"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <p className="text-sm mt-2 text-slate-700">{file ? file.name : 'Click to choose file'}</p>
    </label>
  );
}
