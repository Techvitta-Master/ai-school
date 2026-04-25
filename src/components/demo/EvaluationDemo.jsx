import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Upload, FileText, Wand2, X } from 'lucide-react';
import EvaluationDetailReport from '../shared/EvaluationDetailReport';
import { extractPdfText, isPdfFile } from '../../lib/pdfText';

const API_URL = import.meta.env.VITE_LOCAL_EVAL_URL || 'http://127.0.0.1:8787/api/evaluate';

const SAMPLES = {
  strong: {
    label: 'Strong answer',
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)
Q2. Explain Newton's second law with one real-world example. (5 marks)`,
    answerKey: `Q1. Photosynthesis is the process by which green plants use sunlight to convert carbon dioxide and water into glucose and oxygen. The balanced equation is: 6CO2 + 6H2O -> C6H12O6 + 6O2 (in presence of sunlight and chlorophyll).
Q2. Newton's second law states that the force on an object equals its mass times its acceleration (F = ma). Example: pushing a heavier shopping trolley needs more force to reach the same speed.`,
    studentAnswer: `Q1. Photosynthesis is when plants make food using sunlight. They take in carbon dioxide and water, and release oxygen and glucose. Equation: 6CO2 + 6H2O -> C6H12O6 + 6O2 with help of sunlight and chlorophyll.
Q2. Newton's second law: F = m * a. The force needed depends on mass times acceleration. Example: kicking a heavy football needs more force than a light one to make it move at the same speed.`,
  },
  offtopic: {
    label: 'Off-topic',
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)
Q2. Explain Newton's second law with one real-world example. (5 marks)`,
    answerKey: `Q1. Photosynthesis... 6CO2 + 6H2O -> C6H12O6 + 6O2.
Q2. F = ma.`,
    studentAnswer: `Q1. Volcanoes erupt when magma rises through the crust. There are shield volcanoes and stratovolcanoes.
Q2. Mount Everest is the tallest mountain in the world.`,
  },
  hindi: {
    label: 'Hindi answer to English key',
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)`,
    answerKey: `Q1. Photosynthesis: green plants make glucose from CO2 and water using sunlight. 6CO2 + 6H2O -> C6H12O6 + 6O2.`,
    studentAnswer: `Q1. प्रकाश संश्लेषण वह प्रक्रिया है जिसमें हरे पौधे सूर्य के प्रकाश की उपस्थिति में कार्बन डाइऑक्साइड और पानी से ग्लूकोज और ऑक्सीजन बनाते हैं। समीकरण: 6CO2 + 6H2O -> C6H12O6 + 6O2.`,
  },
};

function FileTextarea({ label, value, onChange, placeholder, required }) {
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setParseError('');
    setFileName(file.name);
    if (isPdfFile(file)) {
      setParsing(true);
      setParseStatus('Loading OCR engine (Hindi + English)...');
      try {
        const result = await extractPdfText(file, {
          onProgress: (p) => {
            if (p.stage === 'ocr-init') setParseStatus(`Loading OCR engine (Hindi + English)...`);
            else if (p.stage === 'ocr-info') setParseStatus(`OCR: ${p.info}...`);
            else if (p.stage === 'ocr-render') setParseStatus(`Rendering page ${p.page} of ${p.total}...`);
            else if (p.stage === 'ocr-recognize') setParseStatus(`OCR'ing page ${p.page} of ${p.total}...`);
            else if (p.stage === 'ocr-progress') setParseStatus(`OCR'ing... ${p.progress}%`);
          },
        });
        if (!result.text.trim()) {
          setParseError('OCR found no recognisable text. The scan may be too low-resolution. Try a higher-quality scan or paste the text manually.');
        } else {
          onChange(result.text);
          setParseStatus(`${result.text.length.toLocaleString()} chars · OCR (${result.ocrLangs}) · ${result.pageCount} pages`);
        }
      } catch (err) {
        setParseError(`Could not parse PDF: ${err.message || err}`);
      } finally {
        setParsing(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        onChange(String(reader.result || ''));
        setParseStatus(`${String(reader.result || '').length.toLocaleString()} chars loaded`);
      };
      reader.readAsText(file);
    }
  };

  const onUpload = (e) => handleFile(e.target.files?.[0]);

  const onDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setFileName('');
    setParseStatus('');
    setParseError('');
    onChange('');
  };

  return (
    <div
      className="space-y-1.5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider font-semibold text-slate-600">
          {label}{required ? <span className="text-rose-500"> *</span> : null}
        </label>
        <label className="text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-1">
          <Upload className="w-3 h-3" /> Upload PDF or .txt
          <input
            type="file"
            accept=".pdf,application/pdf,.txt,text/plain"
            className="hidden"
            onChange={onUpload}
          />
        </label>
      </div>
      {fileName ? (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
          <span className="flex items-center gap-1.5 text-slate-700 min-w-0 truncate">
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{fileName}</span>
            {parsing ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" /> : null}
            {parseStatus && !parsing ? <span className="text-slate-500">· {parseStatus}</span> : null}
          </span>
          <button type="button" onClick={clearFile} className="text-slate-400 hover:text-slate-700 flex-shrink-0 ml-2">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : null}
      {parseError ? (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">{parseError}</p>
      ) : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder + '\n\n(or drop a PDF / .txt file here)'}
        className="w-full min-h-[160px] px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
      />
    </div>
  );
}

const STAGE_LABELS = [
  'Calling Sarvam to extract & pair questions...',
  'Computing semantic embeddings...',
  'Running per-question rubric grading...',
  'Synthesising your improvement plan...',
];

export default function EvaluationDemo() {
  const [questionPaper, setQuestionPaper] = useState('');
  const [answerKey, setAnswerKey] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);

  const loadSample = (key) => {
    const s = SAMPLES[key];
    if (!s) return;
    setQuestionPaper(s.questionPaper);
    setAnswerKey(s.answerKey);
    setStudentAnswer(s.studentAnswer);
    setResult(null);
    setError('');
  };

  const runEvaluation = async () => {
    setError('');
    setResult(null);
    if (!studentAnswer.trim()) {
      setError('Student answer is required.');
      return;
    }
    setRunning(true);
    setStage(0);
    // Step the indicator forward on a timer so the user sees progress
    const tick = setInterval(() => setStage((s) => Math.min(s + 1, STAGE_LABELS.length - 1)), 14000);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionPaper, answerKey, studentAnswer }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Server returned ${res.status}`);
      setResult({ result: body.result, questions: body.questions, plan: body.plan });
      setMeta({
        elapsedMs: body.elapsedMs,
        embeddingsAvailable: body.embeddingsAvailable,
        degraded: body.degraded,
        inputWarnings: body.inputWarnings || [],
        noReference: body.noReference || false,
      });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      clearInterval(tick);
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-700">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs uppercase tracking-widest font-semibold">AI Evaluation Demo</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Semantic answer evaluation, end-to-end</h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Paste or upload three texts — question paper, answer key, and a student's answer — and run them through the full
            Sarvam + LLM-as-judge pipeline. No login, no database. The output uses the same per-question report your
            students and teachers see in production.
          </p>
        </header>

        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" /> Inputs
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Try a sample:</span>
              {Object.entries(SAMPLES).map(([k, s]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => loadSample(k)}
                  className="text-xs px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-full"
                >
                  <Wand2 className="w-3 h-3 inline mr-1" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FileTextarea
              label="Question paper"
              value={questionPaper}
              onChange={setQuestionPaper}
              placeholder="Q1. Define photosynthesis... (5 marks)"
            />
            <FileTextarea
              label="Answer key"
              value={answerKey}
              onChange={setAnswerKey}
              placeholder="Q1. Photosynthesis is the process..."
            />
            <FileTextarea
              required
              label="Student answer"
              value={studentAnswer}
              onChange={setStudentAnswer}
              placeholder="Q1. Plants make food using sunlight..."
            />
          </div>

          {error ? (
            <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Could not run evaluation</p>
                <p className="text-xs mt-1 break-words">{error}</p>
                <p className="text-xs mt-2 text-rose-600">
                  Make sure the local evaluation server is running:{' '}
                  <code className="bg-white/60 px-1 py-0.5 rounded">node scripts/local-evaluate-server.mjs</code>
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-slate-500">
              Server: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{API_URL}</code>
            </div>
            <button
              type="button"
              disabled={running || !studentAnswer.trim()}
              onClick={runEvaluation}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm flex items-center gap-2"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {running ? 'Evaluating...' : 'Run AI Evaluation'}
            </button>
          </div>

          {running ? (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-3 text-sm text-indigo-900 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{STAGE_LABELS[stage]}</span>
              <span className="text-indigo-500 text-xs ml-auto">stage {stage + 1} of {STAGE_LABELS.length}</span>
            </div>
          ) : null}
        </section>

        {result ? (
          <section className="space-y-3">
            {meta?.noReference ? (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-sm text-amber-900 space-y-1.5">
                <p className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Evaluation ran without a valid reference answer
                </p>
                <p className="text-amber-800">
                  The answer key you uploaded {meta.inputWarnings.includes('answer_key_unrelated') ? "appears to be on a different topic than the question paper" : "was empty or unreadable"}.
                  Without a reference, the AI graded each answer using only the question and its own subject knowledge.
                  All scores are flagged for teacher review and should not be used for final marks.
                </p>
                {meta.inputWarnings.length ? (
                  <p className="text-xs text-amber-700">
                    Warnings: {meta.inputWarnings.join(', ')}
                  </p>
                ) : null}
              </div>
            ) : null}
            {meta ? (
              <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                <span>Completed in {(meta.elapsedMs / 1000).toFixed(1)}s</span>
                <span className={meta.embeddingsAvailable ? 'text-emerald-700' : 'text-amber-700'}>
                  Semantic similarity: {meta.embeddingsAvailable ? 'enabled' : 'disabled (LLM-only mode)'}
                </span>
                {meta.degraded ? <span className="text-amber-700">degraded mode</span> : null}
              </div>
            ) : null}
            <EvaluationDetailReport
              result={result.result}
              questions={result.questions}
              plan={result.plan}
              canOverride={false}
              hideModelAnswer={false}
              testTitle="Demo evaluation"
            />
          </section>
        ) : null}

        <footer className="text-xs text-slate-400 pt-6">
          Pipeline: Sarvam OCR (skipped — text inputs) → Sarvam Chat extract & pair → Sarvam Embeddings → Sarvam Chat per-question rubric grading → calibration (LLM-as-truth, semantic-as-disagreement-flag) → plan synthesis. No data is stored.
        </footer>
      </div>
    </div>
  );
}
