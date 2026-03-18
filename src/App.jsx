import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import Login from './components/Login';
import AdminDashboard from './components/admin/AdminDashboard';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import StudentDashboard from './components/student/StudentDashboard';
import Layout from './components/Layout';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser } = useSchool();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={`/${currentUser.role}`} replace />;
  }
  
  return children;
};

const AppRoutes = () => {
  const { currentUser } = useSchool();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout role="admin">
            <AdminDashboard />
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
        currentUser ? (
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
