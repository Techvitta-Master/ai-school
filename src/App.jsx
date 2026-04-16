import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Skeleton } from './components/ui/skeleton';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import AdminDashboard from './components/admin/AdminDashboard';
import SchoolDashboard from './components/school/SchoolDashboard';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import StudentDashboard from './components/student/StudentDashboard';
import Layout from './components/Layout';

// ─── Full-page loading skeleton shown during auth + data hydration ─────────────
function AppSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar skeleton */}
      <div className="w-[260px] bg-white border-r border-slate-100 h-screen flex flex-col p-4 gap-3">
        <Skeleton className="h-9 w-36 rounded-xl mb-4" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-xl" />
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-16 bg-white border-b border-slate-100 flex items-center px-6 gap-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32 rounded" />
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, authLoading, dataLoading } = useSchool();

  if (authLoading || dataLoading) return <AppSkeleton />;

  if (!currentUser) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={`/${currentUser.role}`} replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { currentUser, authLoading, dataLoading } = useSchool();

  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile"  element={<Profile />} />
      <Route path="/settings" element={<Profile />} />

      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout role="admin"><AdminDashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/school/*" element={
        <ProtectedRoute allowedRoles={['school']}>
          <Layout role="school"><SchoolDashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/teacher/*" element={
        <ProtectedRoute allowedRoles={['teacher']}>
          <Layout role="teacher"><TeacherDashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/student/*" element={
        <ProtectedRoute allowedRoles={['student']}>
          <Layout role="student"><StudentDashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/" element={
        authLoading || dataLoading ? <AppSkeleton /> :
        currentUser ? <Navigate to={`/${currentUser.role}`} replace /> :
        <Navigate to="/login" replace />
      } />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <SchoolProvider>
        <AppRoutes />
      </SchoolProvider>
    </BrowserRouter>
  );
}

export default App;
