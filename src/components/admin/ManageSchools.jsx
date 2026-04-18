import { useEffect, useState } from 'react';
import { Building2, Plus, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { fetchSchoolsList } from '../../lib/schoolApi';
import { supabase } from '../../lib/supabaseClient';
import { isApiLayerEnabled } from '../../lib/apiConfig';

export default function ManageSchools() {
  const { createSchool, deleteSchool } = useSchool();
  const [schools, setSchools] = useState([]);
  const [name, setName] = useState('');
  const [schoolAdminEmail, setSchoolAdminEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSchools = async () => {
    try {
      let rows = [];
      if (isApiLayerEnabled()) {
        rows = await fetchSchoolsList();
      } else if (supabase) {
        const { data, error } = await supabase.from('schools').select('id,name').order('name');
        if (error) throw error;
        rows = data || [];
      }
      setSchools(rows || []);
    } catch {
      setSchools([]);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setSuccess('');
    const normalizedAdminEmail = String(schoolAdminEmail || '').trim().toLowerCase();
    const result = await createSchool(name, normalizedAdminEmail, `${name.trim()} Admin`);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(`${result?.school?.name || name} created.`);
    setName('');
    setSchoolAdminEmail('');
    await loadSchools();
  };

  const onDelete = async (s) => {
    if (!window.confirm(`Delete “${s.name}”? This removes all data tied to this school.`)) return;
    setError('');
    setSuccess('');
    setDeletingId(s.id);
    const result = await deleteSchool(s.id);
    setDeletingId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(`“${s.name}” removed.`);
    await loadSchools();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Schools</h2>
        <p className="text-sm text-slate-500">Create and manage school accounts</p>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm">
          <CheckCircle className="w-4 h-4 mt-0.5" />
          {success}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">School Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. Madavi Institute"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">School Login Email</label>
            <input
              type="email"
              value={schoolAdminEmail}
              onChange={(e) => setSchoolAdminEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="admin@school.com"
              required
            />
            <p className="mt-1 text-[11px] text-slate-500">Default password will be 123456.</p>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 px-4 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create School'}
            </button>
          </div>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-slate-800">Existing Schools</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {schools.length ? schools.map((s) => (
            <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="font-medium text-slate-800 truncate">{s.name}</div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(s)}
                disabled={deletingId === s.id}
                className="shrink-0 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 disabled:opacity-50 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                {deletingId === s.id ? 'Removing…' : 'Delete'}
              </button>
            </div>
          )) : (
            <div className="px-6 py-8 text-sm text-slate-400">No schools found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
