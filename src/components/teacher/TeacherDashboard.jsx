import { Routes, Route, Navigate } from 'react-router-dom';
import MyClass from './MyClass';
import TeacherOverview from './TeacherOverview';
import ConductTest from './ConductTest';
import UploadAnalyze from './UploadAnalyze';
import TeacherAddTest from './TeacherAddTest';
import CompareClasses from './CompareClasses';

const ADVANCED_TOOLS = import.meta.env.VITE_ENABLE_ADVANCED_TEACHER_TOOLS === 'true';

export default function TeacherDashboard() {
  return (
    <Routes>
      {/* Default landing — workflow-first class view */}
      <Route index element={<MyClass />} />

      {/* Upload & evaluate answer sheet */}
      <Route path="upload" element={<UploadAnalyze />} />

      <Route path="tests" element={<TeacherAddTest />} />

      {/* Analytics overview */}
      <Route path="analytics" element={<TeacherOverview />} />

      {/* Advanced tools — gated behind feature flag */}
      {ADVANCED_TOOLS && <Route path="conduct-test" element={<ConductTest />} />}
      {ADVANCED_TOOLS && <Route path="compare" element={<CompareClasses />} />}

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/teacher" replace />} />
    </Routes>
  );
}
