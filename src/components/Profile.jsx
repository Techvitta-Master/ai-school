import { createElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext';
import { ArrowLeft, User, Mail, Shield, BookOpen, School, Hash, LogOut } from 'lucide-react';

export default function Profile() {
  const { currentUser, logout } = useSchool();
  const navigate = useNavigate();

  const fields = [
    { icon: User,    label: 'Name',    value: currentUser?.name },
    { icon: Mail,    label: 'Email',   value: currentUser?.email },
    { icon: Shield,  label: 'Role',    value: currentUser?.role?.toUpperCase() },
    { icon: BookOpen,label: 'Subject', value: currentUser?.subject,    hide: !currentUser?.subject },
    { icon: School,  label: 'School',  value: currentUser?.schoolName, hide: !currentUser?.schoolName },
    { icon: Hash,    label: 'User ID', value: currentUser?.id ? `…${String(currentUser.id).slice(-8)}` : '—' },
  ].filter(f => !f.hide);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Hero */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-10 text-center">
            <div className="w-20 h-20 bg-white/25 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-white/30">
              <span className="text-3xl font-bold text-white">
                {currentUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{currentUser?.name || 'Unknown User'}</h2>
            <span className={`inline-block mt-2 px-3 py-0.5 bg-white/20 text-white text-sm rounded-full capitalize`}>
              {currentUser?.role || 'guest'}
            </span>
          </div>

          {/* Fields */}
          <div className="p-6 space-y-3">
            {fields.map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl">
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {createElement(icon, { className: 'w-4 h-4 text-indigo-600' })}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-medium text-slate-800 truncate">{value || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
