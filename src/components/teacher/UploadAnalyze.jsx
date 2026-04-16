import { useState, useRef, useEffect } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { createAndEvaluate } from '../../lib/evaluationService';
import {
  Upload, FileText, Sparkles, CheckCircle, AlertCircle,
  Hash, User, Loader2, RotateCcw, TrendingUp, TrendingDown, ClipboardList,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const MAX_BYTES   = parseInt(import.meta.env.VITE_UPLOAD_MAX_BYTES || '10485760', 10);
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export default function UploadAnalyze() {
  const { data, currentUser, refreshData } = useSchool();
  const [uploading, setUploading]       = useState(false);
  const [result, setResult]             = useState(null);
  const [uploadError, setUploadError]   = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [rollNo, setRollNo]             = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!selectedTestId && data?.tests?.length) {
      setSelectedTestId(data.tests[0].id);
    }
  }, [data?.tests, selectedTestId]);

  const validateFile = (file) => {
    if (file.size > MAX_BYTES)
      return `File too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`;
    if (file.type && !ALLOWED_TYPES.includes(file.type))
      return 'Unsupported file. Upload PDF, JPG, or PNG.';
    return '';
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const err = validateFile(file);
    if (err) { setUploadError(err); return; }
    setUploadError('');
    setSelectedFile(file);
  };

  const handleReset = () => {
    setResult(null);
    setRollNo('');
    setSelectedFile(null);
    setUploadError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile)       { setUploadError('Please select an answer sheet file.'); return; }
    if (!rollNo.trim())      { setUploadError('Please enter the student roll number.'); return; }
    if (!selectedTestId)     { setUploadError('Please select a test.'); return; }

    // Hard-fail if the roll number is unknown — must be enrolled first
    const student = data.students?.find(s => String(s.rollNo) === String(rollNo.trim()));
    if (!student) {
      setUploadError(`No student found with roll number ${rollNo.trim()}. Please enrol them before uploading.`);
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const test = data.tests?.find(t => t.id === selectedTestId);

      // Upload file to Storage (best-effort; evaluation proceeds even if bucket is absent)
      let storagePath = '';
      if (supabase) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        storagePath = `sheets/${currentUser?.id || 'anon'}/roll${rollNo.trim()}-${Date.now()}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from('answer-sheets')
          .upload(storagePath, selectedFile, { contentType: selectedFile.type || undefined, upsert: true });

        if (uploadErr) {
          console.warn('[upload] Storage skipped:', uploadErr.message);
          storagePath = '';
        }
      }

      // Evaluate via the real (dummy) RCA service
      const evaluation = await createAndEvaluate({
        testId: selectedTestId,
        studentId: student.id,
        teacherId: currentUser?.id,
        storagePath,
        test,
        student,
      });

      // Refresh school-wide data so student dashboard updates immediately
      await refreshData();

      setResult({
        fileName:      selectedFile.name,
        studentName:   student.name,
        studentRollNo: rollNo.trim(),
        testTitle:     test?.title || 'Test',
        marks:         evaluation.marks,
        grade:         evaluation.grade,
        feedback:      evaluation.feedback,
        perQuestionScores: evaluation.perQuestionScores ?? [],
        topicRCA:          evaluation.topicRCA          ?? { weak: [], strong: [] },
        improvementPlan:   evaluation.improvementPlan   ?? [],
        topicScores:       evaluation.topicScores       ?? {},
      });
    } catch (err) {
      console.error('[upload] failed:', err);
      setUploadError(err?.message || 'Something went wrong. Please try again.');
    }

    setUploading(false);
  };

  const matchedStudent = data.students?.find(s => String(s.rollNo) === String(rollNo));

  // ─── Result view ────────────────────────────────────────────────────────────
  if (result) {
    const { marks, grade, feedback, perQuestionScores, topicRCA, improvementPlan, topicScores } = result;
    const gradeColor =
      grade === 'A+' || grade === 'A' ? 'text-emerald-600' :
      grade === 'B+' || grade === 'B' ? 'text-indigo-600' :
      grade === 'C'                   ? 'text-amber-600'  : 'text-red-600';

    return (
      <div className="space-y-5 max-w-3xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold">Evaluation Complete</h3>
                <p className="text-indigo-100 text-sm">
                  {result.testTitle} · Roll #{result.studentRollNo} · {result.studentName}
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              New Upload
            </button>
          </div>
        </div>

        {/* Score / Grade / Topics */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Marks',  value: `${marks}/100` },
            { label: 'Grade',  value: grade, className: gradeColor },
            { label: 'Topics', value: Object.keys(topicScores).length || perQuestionScores.length || '—' },
          ].map(({ label, value, className }) => (
            <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
              <p className={`text-2xl font-bold ${className ?? 'text-indigo-600'}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* AI Feedback callout */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">AI Feedback</p>
              <p className="text-sm text-gray-600 leading-relaxed">{feedback}</p>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        {perQuestionScores.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-slate-500" />
              <h4 className="text-sm font-semibold text-gray-800">Question-wise Breakdown</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 pr-3 font-medium">Q#</th>
                    <th className="pb-2 pr-3 font-medium">Topic</th>
                    <th className="pb-2 pr-3 font-medium text-right">Scored</th>
                    <th className="pb-2 font-medium">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {perQuestionScores.map(({ q, topic, max, scored, remark }) => {
                    const pct    = scored / max;
                    const colour = pct >= 0.85 ? 'text-emerald-600' : pct >= 0.65 ? 'text-indigo-600' : pct >= 0.45 ? 'text-amber-600' : 'text-red-600';
                    return (
                      <tr key={q}>
                        <td className="py-2.5 pr-3 font-medium text-gray-700">{q}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{topic}</td>
                        <td className={`py-2.5 pr-3 font-semibold text-right ${colour}`}>
                          {scored}/{max}
                        </td>
                        <td className="py-2.5 text-gray-500 text-xs">{remark}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Topic RCA chips */}
        {(topicRCA.weak.length > 0 || topicRCA.strong.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topicRCA.weak.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Areas to Improve</p>
                </div>
                <div className="space-y-2">
                  {topicRCA.weak.map(({ topic, score, reason }) => (
                    <div key={topic} className="flex items-start gap-2">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full whitespace-nowrap">{topic} · {score}%</span>
                      <span className="text-xs text-red-500 leading-relaxed">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {topicRCA.strong.length > 0 && (
              <div className="bg-emerald-50 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Strong Areas</p>
                </div>
                <div className="space-y-2">
                  {topicRCA.strong.map(({ topic, score, reason }) => (
                    <div key={topic} className="flex items-start gap-2">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full whitespace-nowrap">{topic} · {score}%</span>
                      <span className="text-xs text-emerald-600 leading-relaxed">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Improvement plan */}
        {improvementPlan.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Improvement Plan</h4>
            <ul className="space-y-2">
              {improvementPlan.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ─── Upload form ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Upload &amp; Evaluate Answer Sheet</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter the student's roll number, select the test, upload the answer sheet, then click Evaluate.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1 — identify */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Step 1 — Identify</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Student Roll Number <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={rollNo}
                  onChange={e => setRollNo(e.target.value)}
                  placeholder="e.g. 101"
                  min="1"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              {rollNo && (
                <p className={`mt-1.5 text-xs flex items-center gap-1 ${matchedStudent ? 'text-emerald-600' : 'text-amber-500'}`}>
                  <User className="w-3 h-3" />
                  {matchedStudent
                    ? `${matchedStudent.name} · Class ${matchedStudent.class}-${matchedStudent.section}`
                    : 'Roll number not found — student must be enrolled first'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Attach to Test <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedTestId}
                onChange={e => setSelectedTestId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                {data?.tests?.length ? (
                  data.tests.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))
                ) : (
                  <option value="">No tests available — create a test first</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2 — upload */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Step 2 — Upload Answer Sheet</p>
          <div
            onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files?.[0]); }}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
              selectedFile
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => handleFileSelect(e.target.files?.[0])}
              className="hidden"
            />
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${selectedFile ? 'bg-emerald-100' : 'bg-indigo-100'}`}>
              {selectedFile
                ? <CheckCircle className="w-7 h-7 text-emerald-600" />
                : <Upload className="w-7 h-7 text-indigo-600" />}
            </div>
            {selectedFile ? (
              <>
                <p className="font-semibold text-emerald-700 mb-1">{selectedFile.name}</p>
                <p className="text-sm text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB · Click to replace</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-gray-800 mb-1">Drag &amp; drop or click to upload</p>
                <p className="text-sm text-gray-400">PDF, JPG, or PNG — max {Math.round(MAX_BYTES / 1024 / 1024)} MB</p>
              </>
            )}
          </div>
        </div>

        {uploadError && (
          <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {uploadError}
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !data?.tests?.length}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Evaluating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Submit &amp; Evaluate
            </>
          )}
        </button>

        {!data?.tests?.length && (
          <p className="text-center text-sm text-amber-600">
            No tests found. Ask the admin to create tests before uploading answer sheets.
          </p>
        )}
      </form>
    </div>
  );
}
