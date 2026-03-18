import { Routes, Route, useLocation } from 'react-router-dom';
import StudentScores from './StudentScores';
import StudentPerformance from './StudentPerformance';
import StudentImprovement from './StudentImprovement';

export default function StudentDashboard() {
  const location = useLocation();
  
  if (location.pathname === '/student') {
    return <StudentScores />;
  }

  return (
    <Routes>
      <Route path="/" element={<StudentScores />} />
      <Route path="/performance" element={<StudentPerformance />} />
      <Route path="/improvement" element={<StudentImprovement />} />
    </Routes>
  );
}
