import { useState, useRef } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Upload, FileText, Sparkles, CheckCircle, AlertCircle, BarChart } from 'lucide-react';

export default function UploadAnalyze() {
  const { data, currentUser } = useSchool();
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const fileInputRef = useRef(null);

  const assignedStudents = data.students.filter(s => s.assignedTeacher === currentUser.id);

  const simulateAIAnalysis = (file) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockAnalysis = {
          fileName: file.name,
          uploadTime: new Date().toISOString(),
          summary: {
            totalQuestions: Math.floor(Math.random() * 20) + 10,
            avgScore: Math.floor(Math.random() * 30) + 60,
            highestScore: Math.floor(Math.random() * 20) + 80,
            lowestScore: Math.floor(Math.random() * 30) + 30,
            passRate: Math.floor(Math.random() * 30) + 60
          },
          questionAnalysis: [
            { q: 'Question 1', topic: 'Latitudes', difficulty: 'Easy', avgScore: 85, studentsStruggling: 2 },
            { q: 'Question 2', topic: 'Longitudes', difficulty: 'Medium', avgScore: 72, studentsStruggling: 5 },
            { q: 'Question 3', topic: 'Time Zones', difficulty: 'Hard', avgScore: 58, studentsStruggling: 12 },
            { q: 'Question 4', topic: 'Global Grid', difficulty: 'Medium', avgScore: 68, studentsStruggling: 8 },
            { q: 'Question 5', topic: 'Maps', difficulty: 'Easy', avgScore: 78, studentsStruggling: 4 },
          ],
          recommendations: [
            'Focus more on Time Zones concepts - 60% students need improvement',
            'Consider remedial classes for Longitudes',
            'Maps and Latitudes concepts are well understood',
            'Recommended practice questions for underperforming topics'
          ],
          studentWisePerformance: assignedStudents.slice(0, 5).map(s => ({
            name: s.name,
            score: Math.floor(Math.random() * 40) + 60,
            weakTopics: ['Time Zones', 'Global Grid'],
            strongTopics: ['Maps', 'Latitudes']
          }))
        };
        resolve(mockAnalysis);
      }, 2000);
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const analysis = await simulateAIAnalysis(file);
      setAnalysisResult(analysis);
    } catch (error) {
      console.error('Analysis failed:', error);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Upload & Analyze</h2>
          <p className="text-sm text-gray-500">Upload test papers and get AI-powered analysis</p>
        </div>
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
              { label: 'Total Questions', value: analysisResult.summary.totalQuestions, icon: FileText },
              { label: 'Average Score', value: `${analysisResult.summary.avgScore}%`, icon: BarChart },
              { label: 'Pass Rate', value: `${analysisResult.summary.passRate}%`, icon: CheckCircle },
              { label: 'Needs Attention', value: analysisResult.questionAnalysis.filter(q => q.studentsStruggling > 5).length, icon: AlertCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-indigo-600" />
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
                {analysisResult.questionAnalysis.map((q, i) => (
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
                {analysisResult.recommendations.map((rec, i) => (
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
              {analysisResult.studentWisePerformance.map((student, i) => (
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
