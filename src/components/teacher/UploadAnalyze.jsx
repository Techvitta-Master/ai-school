import { useState, useRef, useEffect, createElement } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Upload, FileText, Sparkles, CheckCircle, AlertCircle, BarChart } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function UploadAnalyze() {
  const { data, currentUser, uploadTestAnalysis } = useSchool();
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const fileInputRef = useRef(null);

  // Pick a default test to attach the analysis to (so persistence has a target).
  useEffect(() => {
    if (!selectedTestId && data?.tests?.length) {
      setSelectedTestId(data.tests[0].id);
    }
  }, [data?.tests, selectedTestId]);

  const validateFile = (file) => {
    const maxBytes = parseInt(import.meta.env.VITE_UPLOAD_MAX_BYTES || '10485760', 10); // 10MB default
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (file.size > maxBytes) return `File too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB.`;
    if (file.type && !allowedTypes.includes(file.type)) return 'Unsupported file type. Upload PDF/JPG/PNG.';
    return '';
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    if (!selectedTestId) {
      setUploadError('Please select a test to attach the analysis to.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');

      const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'test-analyses';
      const functionName = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_ANALYZE || 'analyze_test';

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `analysis/${currentUser.id}/${Date.now()}-${safeName}`;

      const { error: uploadErr } = await supabase.storage.from(bucket).upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

      if (uploadErr) throw uploadErr;

      const { data: fnData, error: fnErr } = await supabase.functions.invoke(functionName, {
        body: { bucket, storagePath },
      });

      if (fnErr) throw fnErr;

      const analysis = fnData?.analysis ?? fnData;

      setAnalysisResult({
        fileName: analysis?.fileName || file.name,
        uploadTime: analysis?.uploadTime || new Date().toISOString(),
        summary: analysis?.summary || {},
        questionAnalysis: analysis?.questionAnalysis || [],
        recommendations: analysis?.recommendations || [],
        studentWisePerformance: analysis?.studentWisePerformance || [],
      });

      // Persist analysis onto the selected test (via our Supabase JSON state row).
      uploadTestAnalysis(selectedTestId, analysis);
    } catch (error) {
      console.error('Analysis failed:', error);
      setUploadError(error?.message || 'Analysis failed. Please try again.');
    }
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleFileUpload(fakeEvent);
    }
  };

  const summary = analysisResult?.summary || {};
  const questionAnalysis = analysisResult?.questionAnalysis || [];
  const recommendations = analysisResult?.recommendations || [];
  const studentWisePerformance = analysisResult?.studentWisePerformance || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Upload & Analyze</h2>
          <p className="text-sm text-gray-500">Upload test papers and get AI-powered analysis</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-700">Attach analysis to test</p>
            <p className="text-xs text-gray-500">Choose the test this paper corresponds to.</p>
          </div>
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"
          >
            {data?.tests?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        {uploadError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
            {uploadError}
          </p>
        )}
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          {uploading ? (
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-indigo-600" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {uploading ? 'Analyzing...' : 'Upload Test Paper'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Drag and drop or click to upload PDF, JPG, or PNG
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
          <span>PDF</span>
          <span>JPG</span>
          <span>PNG</span>
        </div>
      </div>

      {analysisResult && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6" />
              <h3 className="text-lg font-semibold">AI Analysis Complete</h3>
            </div>
            <p className="text-indigo-100">File: {analysisResult.fileName}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Questions', value: summary.totalQuestions, icon: FileText },
              { label: 'Average Score', value: `${summary.avgScore}%`, icon: BarChart },
              { label: 'Pass Rate', value: `${summary.passRate}%`, icon: CheckCircle },
              { label: 'Needs Attention', value: questionAnalysis.filter(q => q.studentsStruggling > 5).length, icon: AlertCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  {createElement(Icon, { className: 'w-5 h-5 text-indigo-600' })}
                  <span className="text-sm text-gray-500">{label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Analysis</h3>
              <div className="space-y-3">
                {questionAnalysis.map((q, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{q.q}: {q.topic}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        q.difficulty === 'Easy' ? 'bg-green-100 text-green-600' :
                        q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {q.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Avg Score: {q.avgScore}%</span>
                      <span className={`${q.studentsStruggling > 5 ? 'text-red-600' : 'text-gray-500'}`}>
                        {q.studentsStruggling} students struggling
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Recommendations</h3>
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl">
                    <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-700">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Performance Breakdown</h3>
            <div className="space-y-4">
              {studentWisePerformance.map((student, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="font-semibold text-indigo-600">{student.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-500">Score: {student.score}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Weak Areas</p>
                      <div className="flex flex-wrap gap-1">
                        {student.weakTopics.map(t => (
                          <span key={t} className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Strong Areas</p>
                      <div className="flex flex-wrap gap-1">
                        {student.strongTopics.map(t => (
                          <span key={t} className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
