import { Routes, Route, useLocation } from 'react-router-dom';
import AdminOverview from '../admin/AdminOverview';
import ManageTeachers from '../admin/ManageTeachers';
import ManageStudents from '../admin/ManageStudents';

export default function SchoolDashboard() {
  const location = useLocation();

  if (location.pathname === '/school') {
    return <AdminOverview />;
  }

  return (
    <Routes>
      <Route path="/" element={<AdminOverview />} />
      <Route path="/teachers" element={<ManageTeachers />} />
      <Route path="/students" element={<ManageStudents />} />
    </Routes>
  );
}
