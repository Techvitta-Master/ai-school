import { Routes, Route, Navigate } from 'react-router-dom';
import AdminOverview from './AdminOverview';
import ManageTeachers from './ManageTeachers';
import ManageStudents from './ManageStudents';
import ManageSections from './ManageSections';
import ManageTests from './ManageTests';
import Performance from './Performance';

const ADMIN_ANALYTICS = import.meta.env.VITE_ENABLE_ADMIN_ANALYTICS === 'true';

export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<AdminOverview />} />
      <Route path="teachers" element={<ManageTeachers />} />
      <Route path="students" element={<ManageStudents />} />
      <Route path="sections" element={<ManageSections />} />
      {ADMIN_ANALYTICS && <Route path="tests" element={<ManageTests />} />}
      {ADMIN_ANALYTICS && <Route path="performance" element={<Performance />} />}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
