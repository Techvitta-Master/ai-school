import { Routes, Route, Navigate } from 'react-router-dom';
import AdminOverview from './AdminOverview';
import ManageSchools from './ManageSchools';

export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<AdminOverview />} />
      <Route path="schools" element={<ManageSchools />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
