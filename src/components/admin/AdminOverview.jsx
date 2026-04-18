import { useEffect, useMemo, useState, createElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, CheckCircle2, Clock3, Plus, Trash2 } from 'lucide-react';
import { fetchSchoolsList, loadSchoolData as loadSchoolDataApi } from '../../lib/schoolApi';
import { supabase } from '../../lib/supabaseClient';
import { isApiLayerEnabled } from '../../lib/apiConfig';
import { useSchool } from '../../context/SchoolContext';
import * as repo from '../../lib/schoolRepository';
import { DeleteSchoolConfirmDialog } from './DeleteSchoolConfirmDialog';

function StatCard({ label, value, hint, icon, tone }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
          {createElement(icon, { className: 'w-5 h-5' })}
        </div>
        <span className="text-xs text-slate-500">{hint}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function AdminOverview() {
  const navigate = useNavigate();
  const { createSchool, deleteSchool } = useSchool();
  const [schools, setSchools] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [schoolPendingDelete, setSchoolPendingDelete] = useState(null);
  const [latestSchoolMetrics, setLatestSchoolMetrics] = useState({
    schoolName: '',
    status: 'Not Ready',
    teacherCount: 0,
    missing: [],
    lastUpdatedText: 'just now',
  });
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSchools = async () => {
    setLoading(true);
    try {
      let rows = [];
      if (isApiLayerEnabled()) {
        rows = await fetchSchoolsList();
      } else if (supabase) {
        const { data, error } = await supabase.from('schools').select('id,name,created_at').order('created_at');
        if (error) throw error;
        rows = data || [];
      }
      setSchools(rows || []);
    } catch {
      setSchools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const toRelativeTime = (dateValue) => {
      const ts = new Date(dateValue || 0).getTime();
      if (!ts || Number.isNaN(ts)) return 'just now';
      const diffMs = Date.now() - ts;
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    };

    const loadLatestSchoolMetrics = async () => {
      if (!schools.length) {
        if (!cancelled) {
          setLatestSchoolMetrics({
            schoolName: 'No schools yet',
            status: 'Not Ready',
            teacherCount: 0,
            missing: ['Teachers', 'Class assignments'],
            lastUpdatedText: 'just now',
          });
        }
        return;
      }

      const latest = [...schools].sort((a, b) => {
        const ad = new Date(a?.created_at || 0).getTime();
        const bd = new Date(b?.created_at || 0).getTime();
        return bd - ad;
      })[0];

      try {
        let scopedData;
        if (isApiLayerEnabled()) {
          const { data: s } = await supabase.auth.getSession();
          const token = s?.session?.access_token;
          if (!token) throw new Error('No access token.');
          scopedData = await loadSchoolDataApi(token, { schoolId: latest.id });
        } else {
          scopedData = await repo.loadSchoolData(supabase, { schoolId: latest.id });
        }

        const teachers = scopedData?.teachers?.length ?? 0;
        const schoolClasses = scopedData?.schoolClasses ?? [];
        const hasClassAssignments = schoolClasses.some((c) => Array.isArray(c.teachers) && c.teachers.length > 0);

        const missing = [];
        if (teachers <= 0) missing.push('Teachers');
        if (!hasClassAssignments) missing.push('Class assignments');

        const status = missing.length === 0 ? 'Ready' : 'Not Ready';

        if (!cancelled) {
          setLatestSchoolMetrics({
            schoolName: latest?.name || 'Latest school',
            status,
            teacherCount: teachers,
            missing,
            lastUpdatedText: toRelativeTime(latest?.created_at),
          });
        }
      } catch {
        if (!cancelled) {
          setLatestSchoolMetrics({
            schoolName: latest?.name || 'Latest school',
            status: 'Status Unavailable',
            teacherCount: 0,
            missing: ['Teachers', 'Class assignments'],
            lastUpdatedText: 'just now',
          });
        }
      }
    };

    loadLatestSchoolMetrics();

    return () => {
      cancelled = true;
    };
  }, [schools]);

  const stats = useMemo(() => {
    const totalSchools = schools.length;
    return {
      totalSchools,
    };
  }, [schools]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    setSuccess('');
    const result = await createSchool(name);
    setCreating(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(`${result?.school?.name || name} created successfully.`);
    setName('');
    await loadSchools();
  };

  const confirmDeleteSchool = async () => {
    if (!schoolPendingDelete) return;
    const s = schoolPendingDelete;
    setError('');
    setSuccess('');
    setDeletingId(s.id);
    const result = await deleteSchool(s.id);
    setDeletingId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSchoolPendingDelete(null);
    setSuccess(`“${s.name}” removed.`);
    await loadSchools();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of school onboarding and platform progress</p>
        </div>
        <button
          onClick={() => navigate('/admin/schools')}
          className="bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 px-4 py-2.5 text-sm font-medium"
        >
          Manage Schools
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Schools"
          value={loading ? '...' : stats.totalSchools}
          hint="Onboarded"
          icon={Building2}
          tone="bg-indigo-100 text-indigo-600"
        />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs text-slate-500">Live feed</span>
          </div>
          <p className="text-sm text-slate-500">Latest Activity</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{latestSchoolMetrics.schoolName}</p>
          <p className="text-sm text-slate-700 mt-1">onboarded</p>
          <p className="text-sm text-slate-700">{latestSchoolMetrics.teacherCount} teachers added</p>
          <p className="text-xs text-slate-500 mt-2">Last update: {latestSchoolMetrics.lastUpdatedText}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-700">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs text-slate-500">Readiness</span>
          </div>
          <p className="text-sm text-slate-500">School Status</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{latestSchoolMetrics.schoolName}</p>
          <p className="text-sm font-semibold mt-1">
            {latestSchoolMetrics.status === 'Ready' ? '🟢 Ready' : '🟡 Not Ready'}
          </p>
          {latestSchoolMetrics.missing.length ? (
            <p className="text-xs text-slate-600 mt-2">
              Missing: {latestSchoolMetrics.missing.join(', ')}
            </p>
          ) : (
            <p className="text-xs text-slate-600 mt-2">All setup checkpoints completed.</p>
          )}
          <p className="text-xs text-slate-500 mt-2">Last updated: {latestSchoolMetrics.lastUpdatedText}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Quick Create School</h2>
          <p className="text-sm text-slate-500 mt-1">Fast onboarding from the dashboard.</p>
          <form onSubmit={onCreate} className="mt-4 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. Madavi Institute"
              required
            />
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {creating ? 'Creating...' : 'Create School'}
            </button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Schools</h2>
            <button
              onClick={loadSchools}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <Clock3 className="w-4 h-4" />
              Refresh
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-8 text-sm text-slate-400">Loading schools...</div>
            ) : schools.length ? (
              schools.slice(-8).reverse().map((s) => (
                <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-sm font-medium text-slate-800 truncate">{s.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSchoolPendingDelete({ id: s.id, name: s.name })}
                    disabled={deletingId === s.id}
                    className="shrink-0 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingId === s.id ? '…' : 'Delete'}
                  </button>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-sm text-slate-400">No schools created yet.</div>
            )}
          </div>
        </div>
      </div>

      <DeleteSchoolConfirmDialog
        school={schoolPendingDelete}
        deleting={Boolean(schoolPendingDelete && deletingId === schoolPendingDelete.id)}
        onCancel={() => setSchoolPendingDelete(null)}
        onConfirm={confirmDeleteSchool}
      />
    </div>
  );
}
