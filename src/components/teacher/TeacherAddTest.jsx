import { useMemo, useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Plus, Loader2, ClipboardList, FileText, Clock, Target, Trash2 } from 'lucide-react';

export default function TeacherAddTest() {
  const { data, createTest, removeTest, getCurrentTeacher, getCurrentTeacherId, getTeacherRelevantTestIds } = useSchool();
  const teacherId = getCurrentTeacherId();
  const teacherTestIds = useMemo(
    () => (teacherId ? getTeacherRelevantTestIds(teacherId) : new Set()),
    [teacherId, getTeacherRelevantTestIds]
  );
  const tests = useMemo(
    () =>
      [...(data?.tests ?? [])]
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [data?.tests]
  );
  const classOptions = useMemo(() => {
    const allClasses = data?.schoolClasses ?? [];
    const teacher = getCurrentTeacher();
    const assigned = teacher?.classes ?? [];
    if (!assigned.length) return allClasses;
    const assignedKeys = new Set(assigned.map((c) => String(c.class)));
    return allClasses.filter((c) => assignedKeys.has(String(c.class)));
  }, [data?.schoolClasses, getCurrentTeacher]);
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('');
  const [totalMarks, setTotalMarks] = useState(100);
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!title.trim()) {
      setError('Enter a test title.');
      return;
    }
    setSaving(true);
    const r = await createTest({
      title: title.trim(),
      classId,
      totalMarks,
      duration,
      topics: [],
    });
    setSaving(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    setSuccess('Test saved. Use Upload & Analyze to attach answer sheets.');
    setTitle('');
    setClassId('');
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleDelete = async (id) => {
    setError('');
    setSuccess('');
    setDeletingId(id);
    try {
      await removeTest(id);
      setSuccess('Test deleted.');
    } catch (err) {
      setError(err?.message || 'Failed to delete test.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Add test</h1>
        <p className="text-sm text-slate-500 mt-1">
          Give it a name; it will show under <strong className="text-slate-700">Attach to test</strong> on Upload &amp; Analyze.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="font-semibold text-slate-800">New test</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid-term Science"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              required
            >
              <option value="">Select class</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className || `Class ${c.class}`}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Total marks</label>
              <input
                type="number"
                min={1}
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseInt(e.target.value, 10) || 100)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (min)</label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 60)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save test'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">{success}</p>
          )}
        </form>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Your tests</h2>
            <p className="text-xs text-slate-500">Same list as in Upload &amp; Analyze → Attach to test</p>
          </div>
        </div>

        {tests.length === 0 ? (
          <p className="text-sm text-slate-500">No tests yet — add one above.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {tests.map((t) => (
              <li key={t.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{t.title}</p>
                  {(t.chapter > 0 || t.theme || t.domain) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[t.theme && `Theme: ${t.theme}`, t.chapter > 0 && `Ch. ${t.chapter}`, t.domain].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    {teacherTestIds.has(t.id) ? 'Teacher-related test' : 'All-school test'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 shrink-0">
                  <span className="inline-flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-indigo-500" />
                    {t.totalMarks ?? 100} marks
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    {t.duration ?? 60} min
                  </span>
                  {t.createdAt && (
                    <span className="text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                    title="Delete test"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingId === t.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
