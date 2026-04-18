import { Routes, Route } from 'react-router-dom';
import StudentScores from './StudentScores';
import StudentPerformance from './StudentPerformance';
import StudentImprovement from './StudentImprovement';
import StudentReportCardPage from './StudentReportCardPage';

export default function StudentDashboard() {
  return (
    <Routes>
      <Route index element={<StudentScores />} />
      <Route path="performance" element={<StudentPerformance />} />
      <Route path="improvement" element={<StudentImprovement />} />
      <Route path="report-card" element={<StudentReportCardPage />} />
    </Routes>
  );
}
