import { Routes, Route, useLocation } from 'react-router-dom';
import TeacherOverview from './TeacherOverview';
import ConductTest from './ConductTest';
import UploadAnalyze from './UploadAnalyze';
import CompareClasses from './CompareClasses';

export default function TeacherDashboard() {
  const location = useLocation();
  
  if (location.pathname === '/teacher') {
    return <TeacherOverview />;
  }

  return (
    <Routes>
      <Route path="/" element={<TeacherOverview />} />
      <Route path="/conduct-test" element={<ConductTest />} />
      <Route path="/upload" element={<UploadAnalyze />} />
      <Route path="/compare" element={<CompareClasses />} />
    </Routes>
  );
}
