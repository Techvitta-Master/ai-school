import { useState, createElement } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext';
import { GraduationCap, LayoutDashboard, Users, GraduationCap as StudentIcon, BookOpen, FileText, BarChart3, LogOut, ChevronLeft, Bell, Search, Plus } from 'lucide-react';
import { Avatar } from './ui/avatar';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

const roleConfig = {
  admin: {
    title: 'Dashboard',
    items: [
      { path: '/admin', label: 'Overview', icon: LayoutDashboard },
      { path: '/admin/teachers', label: 'Teachers', icon: Users },
      { path: '/admin/students', label: 'Students', icon: StudentIcon },
      { path: '/admin/sections', label: 'Classes', icon: BookOpen },
      { path: '/admin/tests', label: 'Tests', icon: FileText },
      { path: '/admin/performance', label: 'Analytics', icon: BarChart3 },
    ]
  },
  school: {
    title: 'School Admin',
    items: [
      { path: '/school', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  teacher: {
    title: 'Teaching Portal',
    items: [
      { path: '/teacher', label: 'My Class', icon: Users },
      { path: '/teacher/upload', label: 'Upload & Analyze', icon: BarChart3 },
      { path: '/teacher/analytics', label: 'Analytics', icon: LayoutDashboard },
    ]
  },
  student: {
    title: 'Dashboard',
    items: [
      { path: '/student', label: 'Scores', icon: FileText },
      { path: '/student/performance', label: 'Performance', icon: BarChart3 },
      { path: '/student/improvement', label: 'Improvement', icon: BookOpen },
    ]
  }
};

export default function Layout({ children, role }) {
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`${collapsed ? 'w-[72px]' : 'w-[260px]'} bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col transition-all duration-300`}>
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
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {config.items.map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path;
              return (
                <button
                  type="button"
                  key={path}
                  onClick={() => navigate(path)}
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
              <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
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
