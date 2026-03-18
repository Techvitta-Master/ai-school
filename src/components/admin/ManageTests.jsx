import { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { FileText, Plus, Trash2, Clock, Target, BookOpen } from 'lucide-react';

export default function ManageTests() {
  const { data, createTest, removeTest } = useSchool();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    chapter: '',
    theme: '',
    domain: '',
    topics: '',
    duration: 60,
    totalMarks: 100
  });

  const handleSubmit = (e) => {
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
    
    setFormData({ title: '', chapter: '', theme: '', domain: '', topics: '', duration: 60, totalMarks: 100 });
    setShowForm(false);
  };

  const handleThemeChange = (themeId) => {
    const theme = data.syllabus.themes.find(t => t.theme === themeId);
    setFormData({
      ...formData,
      theme: themeId,
      domain: theme?.domain || '',
      chapter: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tests</h2>
          <p className="text-sm text-gray-500">Create and manage test papers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Test
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Test</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                placeholder="e.g., Chapter 1 Assessment"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
              <select
                value={formData.theme}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                required
              >
                <option value="">Select Theme</option>
                {data.syllabus.themes.map(t => (
                  <option key={t.theme} value={t.theme}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
              <select
                value={formData.chapter}
                onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                required
              >
                <option value="">Select Chapter</option>
                {data.syllabus.themes.find(t => t.theme === formData.theme)?.chapters.map(c => (
                  <option key={c.chapter_number} value={c.chapter_number}>
                    Chapter {c.chapter_number}: {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                min="15"
                max="180"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
              <input
                type="number"
                value={formData.totalMarks}
                onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                min="10"
                max="100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Topics (comma-separated)</label>
              <input
                type="text"
                value={formData.topics}
                onChange={(e) => setFormData({ ...formData, topics: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                placeholder="e.g., Latitudes, Longitudes, Time Zones"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="px-6 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700">
                Create Test
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.tests.map(test => (
          <div key={test.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <button
                onClick={() => removeTest(test.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <h3 className="font-semibold text-gray-900 mb-1">{test.title}</h3>
            <p className="text-sm text-gray-500 mb-4">Chapter {test.chapter} • {test.domain}</p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                {test.duration} minutes
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Target className="w-4 h-4" />
                {test.totalMarks} marks
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <BookOpen className="w-4 h-4" />
                {test.topics?.length || 0} topics
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Created {new Date(test.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
