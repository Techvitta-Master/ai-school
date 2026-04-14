import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/admin/AdminDashboard';
import SchoolDashboard from './components/school/SchoolDashboard';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import StudentDashboard from './components/student/StudentDashboard';
import Layout from './components/Layout';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, authLoading, dataLoading } = useSchool();
  
  if (authLoading || dataLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={`/${currentUser.role}`} replace />;
  }
  
  return children;
};

const AppRoutes = () => {
  const { currentUser, authLoading, dataLoading } = useSchool();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout role="admin">
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/school/*" element={
        <ProtectedRoute allowedRoles={['school']}>
          <Layout role="school">
            <SchoolDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/teacher/*" element={
        <ProtectedRoute allowedRoles={['teacher']}>
          <Layout role="teacher">
            <TeacherDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/student/*" element={
        <ProtectedRoute allowedRoles={['student']}>
          <Layout role="student">
            <StudentDashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/" element={
        authLoading || dataLoading ? (
          <div className="p-8">Loading...</div>
        ) : currentUser ? (
          <Navigate to={`/${currentUser.role}`} replace />
        ) : (
          <Navigate to="/login" replace />
        )
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
