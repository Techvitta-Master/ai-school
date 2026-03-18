import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import AdminOverview from './AdminOverview';
import ManageTeachers from './ManageTeachers';
import ManageStudents from './ManageStudents';
import ManageSections from './ManageSections';
import ManageTests from './ManageTests';
import Performance from './Performance';

export default function AdminDashboard() {
  const location = useLocation();
  
  if (location.pathname === '/admin') {
    return <AdminOverview />;
  }

  return (
    <Routes>
      <Route path="/" element={<AdminOverview />} />
      <Route path="/teachers" element={<ManageTeachers />} />
      <Route path="/students" element={<ManageStudents />} />
      <Route path="/sections" element={<ManageSections />} />
      <Route path="/tests" element={<ManageTests />} />
      <Route path="/performance" element={<Performance />} />
    </Routes>
  );
}
