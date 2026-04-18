import { useState, useMemo } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { FileText, Plus, Users, BarChart, ChevronDown, ChevronUp, X, CheckCircle, AlertTriangle, Clock, BookOpen, ArrowRight } from 'lucide-react';

export default function ConductTest() {
  const {
    data,
    createTest,
    addScore,
    getStudentPerformanceForTeacher,
    getTeacherAssignedStudents,
    getTeacherRelevantTestIds,
    getCurrentTeacherId,
  } = useSchool();
  const teacherId = getCurrentTeacherId();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [newScore, setNewScore] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    chapter: '',
    theme: '',
    domain: '',
    topics: '',
    duration: 60,
    totalMarks: 100
  });

  const assignedStudents = useMemo(
    () => (teacherId ? getTeacherAssignedStudents(teacherId) : []),
    [teacherId, getTeacherAssignedStudents]
  );
  const teacherTestIds = useMemo(
    () => (teacherId ? getTeacherRelevantTestIds(teacherId) : new Set()),
    [teacherId, getTeacherRelevantTestIds]
  );

  const handleCreateTest = (e) => {
    e.preventDefault();
    createTest({
      title: formData.title,
      chapter: parseInt(formData.chapter),
      theme: formData.theme,
      domain: formData.domain,
      topics: formData.topics.split(',').map(t => t.trim()).filter(Boolean),
      duration: formData.duration,
      totalMarks: formData.totalMarks
    });
    setShowCreate(false);
    setFormData({ title: '', chapter: '', theme: '', domain: '', topics: '', duration: 60, totalMarks: 100 });
  };

  const handleThemeChange = (themeId) => {
    const theme = data.syllabus.themes.find(t => t.theme === themeId);
    setFormData({ ...formData, theme: themeId, domain: theme?.domain || '', chapter: '' });
  };

  const handleAssignScore = () => {
    if (expandedStudent && selectedTest && newScore) {
      addScore(expandedStudent.id, selectedTest.id, { score: parseInt(newScore) });
      setSuccessMessage(`Score assigned to ${expandedStudent.name}`);
      setNewScore('');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const getTestByStudent = (studentId) => {
    const student = data.students.find(s => s.id === studentId);
    return (student?.scores || []).filter((sc) => teacherTestIds.has(sc.testId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Student Performance</h1>
          <p className="text-slate-500 mt-1">View details and assign test scores</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Test
        </button>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {showCreate && (
        <div className="glass rounded-2xl p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Create New Test</h3>
            <button type="button" onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/50 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleCreateTest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Test Title</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 bg-white/80 border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-emerald-500/50" placeholder="e.g., Chapter 1 Quiz" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Theme</label>
              <select value={formData.theme} onChange={(e) => handleThemeChange(e.target.value)} className="w-full px-4 py-3 bg-white/80 border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-emerald-500/50" required>
                <option value="">Select Theme</option>
                {data.syllabus.themes.map(t => (<option key={t.theme} value={t.theme}>{t.title}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Chapter</label>
              <select value={formData.chapter} onChange={(e) => setFormData({ ...formData, chapter: e.target.value })} className="w-full px-4 py-3 bg-white/80 border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-emerald-500/50" required>
                <option value="">Select Chapter</option>
                {data.syllabus.themes.find(t => t.theme === formData.theme)?.chapters.map(c => (<option key={c.chapter_number} value={c.chapter_number}>Ch {c.chapter_number}: {c.title}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Duration (min)</label>
              <input type="number" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })} className="w-full px-4 py-3 bg-white/80 border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Total Marks</label>
              <input type="number" value={formData.totalMarks} onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value) })} className="w-full px-4 py-3 bg-white/80 border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg transition-all">Create Test</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-slate-200/30 bg-white/30">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            My Students ({assignedStudents.length})
          </h3>
        </div>
        
        <div className="divide-y divide-slate-200/30">
          {assignedStudents.map((student) => {
            const perf = getStudentPerformanceForTeacher(student.id, teacherId);
            const isExpanded = expandedStudent?.id === student.id;
            const studentTests = getTestByStudent(student.id);
            
            return (
              <div key={student.id}>
                <button
                  type="button"
                  onClick={() => setExpandedStudent(isExpanded ? null : student)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-lg font-bold text-white">{student.name.charAt(0)}</span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-slate-800">{student.name}</p>
                      <p className="text-sm text-slate-500">Class {student.class} • Roll: {student.rollNo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-bold text-lg ${
                        perf?.overallScore >= 70 ? 'text-emerald-600' : perf?.overallScore >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {Math.round(perf?.overallScore || 0)}%
                      </p>
                      <p className="text-xs text-slate-400">{studentTests.length} tests</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-white/50 rounded-xl p-4">
                        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                          <BarChart className="w-5 h-5 text-indigo-600" />
                          Performance Overview
                        </h4>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-white/80 p-3 rounded-xl text-center">
                            <p className="text-2xl font-bold text-slate-800">{Math.round(perf?.overallScore || 0)}%</p>
                            <p className="text-xs text-slate-500">Overall</p>
                          </div>
                          <div className="bg-emerald-50 p-3 rounded-xl text-center">
                            <p className="text-2xl font-bold text-emerald-600">
                              {Object.values(perf?.subjectWise || {}).length > 0 ? Math.round(Math.max(...Object.values(perf?.subjectWise || {}))) : 0}%
                            </p>
                            <p className="text-xs text-slate-500">Best</p>
                          </div>
                          <div className="bg-amber-50 p-3 rounded-xl text-center">
                            <p className="text-2xl font-bold text-amber-600">
                              {Object.values(perf?.subjectWise || {}).length > 0 ? Math.round(Math.min(...Object.values(perf?.subjectWise || {}))) : 0}%
                            </p>
                            <p className="text-xs text-slate-500">Needs Work</p>
                          </div>
                        </div>
                        <h5 className="text-sm font-medium text-slate-600 mb-2">Subject Scores</h5>
                        <div className="space-y-2">
                          {Object.entries(perf?.subjectWise || {}).map(([subject, score]) => (
                            <div key={subject} className="bg-white/80 p-2 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-slate-600">{subject}</span>
                                <span className={`text-sm font-bold ${score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {Math.round(score)}%
                                </span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    score >= 70 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                                    score >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                                    'bg-gradient-to-r from-red-400 to-red-500'
                                  }`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white/50 rounded-xl p-4">
                        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-indigo-600" />
                          Assign Score
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Select Test</label>
                            <select
                              value={selectedTest?.id || ''}
                              onChange={(e) => setSelectedTest(data.tests.find(t => t.id === e.target.value))}
                              className="w-full px-3 py-2.5 bg-white/80 border border-slate-200/50 rounded-xl"
                            >
                              <option value="">Choose a test</option>
                              {data.tests
                                .filter((t) => teacherTestIds.has(t.id))
                                .map(t => (<option key={t.id} value={t.id}>{t.title} (Ch {t.chapter})</option>))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Score (%)</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={newScore}
                                onChange={(e) => setNewScore(e.target.value)}
                                className="flex-1 px-3 py-2.5 bg-white/80 border border-slate-200/50 rounded-xl"
                                placeholder="0-100"
                                min="0"
                                max="100"
                              />
                              <button
                                type="button"
                                onClick={handleAssignScore}
                                disabled={!selectedTest || !newScore}
                                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                Assign
                              </button>
                            </div>
                          </div>
                        </div>

                        <h5 className="text-sm font-medium text-slate-600 mb-2 mt-4">Recent Tests</h5>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {studentTests.slice(0, 5).map(sc => {
                            const test = data.tests.find(t => t.id === sc.testId);
                            return (
                              <div key={sc.id} className="flex items-center justify-between p-2 bg-white/80 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm text-slate-700">{test?.title || 'Test'}</span>
                                </div>
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                  sc.score >= 70 ? 'bg-emerald-100 text-emerald-700' :
                                  sc.score >= 50 ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {sc.score}%
                                </span>
                              </div>
                            );
                          })}
                          {studentTests.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-4">No tests yet</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {perf?.weakTopics?.length > 0 && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-amber-50 rounded-xl border border-red-100">
                        <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Topics Needing Attention
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {perf.weakTopics.map(([topic]) => (
                            <span key={topic} className="px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded-full text-sm font-medium">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
