import { useState, createElement } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext';
import {
  GraduationCap, LayoutDashboard, Users,
  BookOpen, FileText, BarChart3, LogOut, ChevronLeft, Bell, Search, Menu, X, Building2, Network,
} from 'lucide-react';
import { Avatar } from './ui/avatar';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

const ADVANCED_TEACHER  = import.meta.env.VITE_ENABLE_ADVANCED_TEACHER_TOOLS === 'true';

const buildRoleConfig = () => ({
  admin: {
    title: 'Dashboard',
    items: [
      { path: '/admin', label: 'Overview', icon: LayoutDashboard },
      { path: '/admin/schools', label: 'Schools', icon: Building2 },
    ],
  },
  school: {
    title: 'School',
    items: [
      { path: '/school', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/school/classes', label: 'Classes', icon: BookOpen },
      { path: '/school/subjects', label: 'Subjects', icon: FileText },
      { path: '/school/teachers', label: 'Teachers', icon: Users },
      { path: '/school/students', label: 'Students', icon: GraduationCap },
      { path: '/school/assign-teachers', label: 'Teachers ↔ classes', icon: Network },
    ],
  },
  teacher: {
    title: 'Teaching Portal',
    items: [
      { path: '/teacher', label: 'My Class', icon: Users },
      { path: '/teacher/tests', label: 'Add test', icon: FileText },
      { path: '/teacher/upload', label: 'Upload & Analyze', icon: BarChart3 },
      { path: '/teacher/analytics', label: 'Analytics', icon: LayoutDashboard },
      ...(ADVANCED_TEACHER ? [
        { path: '/teacher/conduct-test', label: 'Conduct Test', icon: FileText },
        { path: '/teacher/compare', label: 'Compare Classes', icon: BookOpen },
      ] : []),
    ],
  },
  student: {
    title: 'Dashboard',
    items: [
      { path: '/student', label: 'Scores', icon: FileText },
      { path: '/student/performance', label: 'Performance', icon: BarChart3 },
      { path: '/student/improvement', label: 'Improvement', icon: BookOpen },
    ],
  },
});

const roleConfig = buildRoleConfig();

export default function Layout({ children, role }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentUser, logout } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();
  const config = roleConfig[role];

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'school': return 'bg-amber-100 text-amber-800';
      case 'teacher': return 'bg-blue-100 text-blue-700';
      case 'student': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleNavClick = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`
        ${collapsed ? 'md:w-[72px]' : 'md:w-[260px]'}
        bg-white border-r border-slate-200 h-screen flex flex-col transition-all duration-300
        fixed md:sticky top-0 z-50 md:z-auto
        ${mobileOpen ? 'flex w-[260px]' : 'hidden md:flex'}
      `}>
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-slate-900">AI School</span>
            </div>
          ) : (
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
          )}
          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 hover:bg-slate-100 rounded-lg md:hidden"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {config.items.map(({ path, label, icon: Icon }) => {
              const active =
                path === '/school' || path === '/admin'
                  ? location.pathname === path || location.pathname === `${path}/`
                  : location.pathname === path || location.pathname.startsWith(`${path}/`);
              return (
                <button
                  type="button"
                  key={path}
                  onClick={() => handleNavClick(path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  {createElement(Icon, {
                    className: `w-5 h-5 ${active ? 'text-indigo-600' : 'text-slate-500'}`,
                  })}
                  {!collapsed && <span>{label}</span>}
                  {active && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-3 border-t border-slate-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors ${collapsed ? 'justify-center' : ''}`}
              >
                <Avatar name={currentUser?.name} className="w-8 h-8" />
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-900 truncate">{currentUser?.name}</p>
                    <Badge className={`${getRoleBadgeColor(role)} text-[10px] px-1.5 py-0`}>
                      {role}
                    </Badge>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Bell className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 h-16 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors md:hidden"
            >
              <Menu className="w-5 h-5 text-slate-500" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors hidden md:flex"
            >
              <ChevronLeft className={`w-5 h-5 text-slate-500 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 capitalize">{config.title}</h1>
              <p className="text-xs text-slate-500">
                {role === 'school' && currentUser?.schoolName
                  ? currentUser.schoolName
                  : role === 'admin'
                    ? 'School Management'
                    : role === 'school'
                      ? 'School organization'
                      : role === 'teacher'
                        ? `Welcome, ${currentUser?.name?.split(' ')[0] ?? 'Teacher'}`
                        : 'Student Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-64 h-9 pl-9 pr-4 bg-slate-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
          </div>
        </header>
        
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
