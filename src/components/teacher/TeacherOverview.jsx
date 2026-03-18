import { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Users, TrendingUp, AlertTriangle, BookOpen, Award, Eye, Star, TrendingDown, Search } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg text-sm shadow-lg border border-slate-200">
        <p className="font-medium text-slate-800">{payload[0].payload.name}</p>
        <p className="text-indigo-600 font-semibold">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export default function TeacherOverview() {
  const { currentUser, data, getStudentPerformance, getTeacherPerformance } = useSchool();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const assignedStudents = data.students.filter(s => s.assignedTeacher === currentUser.id);
  const perf = getTeacherPerformance(currentUser.id);

  const filteredStudents = assignedStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const classData = {};
  for (const s of assignedStudents) {
    const key = `${s.class}-${s.section}`;
    if (!classData[key]) classData[key] = { scores: [] };
    for (const sc of s.scores) {
      classData[key].scores.push(sc.score);
    }
  }

  for (const key of Object.keys(classData)) {
    const scores = classData[key].scores;
    classData[key].avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  const chartData = Object.entries(classData).map(([key, val]) => ({
    name: key,
    score: val.avg,
    students: assignedStudents.filter(s => `${s.class}-${s.section}` === key).length
  }));

  const weakTopicsMap = {};
  for (const s of assignedStudents) {
    const studentPerf = getStudentPerformance(s.id);
    for (const [topic, score] of studentPerf?.weakTopics || []) {
      if (!weakTopicsMap[topic]) weakTopicsMap[topic] = { count: 0, totalScore: 0 };
      weakTopicsMap[topic].count++;
      weakTopicsMap[topic].totalScore += score;
    }
  }

  const topWeakTopics = Object.entries(weakTopicsMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const performanceData = chartData.length > 0 ? chartData : [{ name: 'No Data', score: 0 }];

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 70) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const handleViewDetails = (student) => {
    setSelectedStudent(student);
    setShowDetailsModal(true);
  };

  const selectedStudentPerf = selectedStudent ? getStudentPerformance(selectedStudent.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {currentUser?.name?.split(' ')[0]}!</h1>
          <p className="text-slate-500 mt-1">Track your students&apos; progress and performance</p>
        </div>
        <Badge className="bg-indigo-100 text-indigo-700 px-3 py-1">{currentUser?.subject}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="animate-fade-in">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">My Students</p>
                <p className="text-2xl font-bold text-slate-800">{assignedStudents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Avg Performance</p>
                <p className="text-2xl font-bold text-slate-800">{Math.round(perf?.avgPerformance || 0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Attention Needed</p>
                <p className="text-2xl font-bold text-slate-800">{topWeakTopics.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Class Performance</h3>
                <p className="text-sm text-slate-500">Average scores by section</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="teacherScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} fill="url(#teacherScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Attention Needed</h3>
                <p className="text-sm text-slate-500">Topics students struggle with</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topWeakTopics.length > 0 ? (
              <div className="space-y-4">
                {topWeakTopics.map(([topic, topicData]) => (
                  <div key={topic} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700 truncate pr-2">{topic}</span>
                      <Badge variant="warning" className="text-xs">{topicData.count} students</Badge>
                    </div>
                    <Progress value={Math.min((topicData.count / assignedStudents.length) * 100, 100)} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">All topics going well!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                My Students
              </h3>
              <p className="text-sm text-slate-500">{assignedStudents.length} students assigned</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search students..." 
                className="pl-9 w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Overall</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tests</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => {
                  const studentPerf = getStudentPerformance(s.id);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} className="w-9 h-9" />
                          <div>
                            <p className="font-medium text-slate-900">{s.name}</p>
                            <p className="text-xs text-slate-500">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">Class {s.class}-{s.section}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(studentPerf?.overallScore || 0)}`}>
                            {Math.round(studentPerf?.overallScore || 0)}%
                          </span>
                          <Progress value={studentPerf?.overallScore || 0} className="h-1.5 w-16" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.scores?.length || 0}</td>
                      <td className="px-4 py-3">
                        <Badge className={getScoreBg(studentPerf?.overallScore || 0)}>
                          {studentPerf?.overallScore >= 70 ? 'Good' : studentPerf?.overallScore >= 50 ? 'Average' : 'Needs Help'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => handleViewDetails(s)}
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-4">
                <Avatar name={selectedStudent?.name} className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-semibold">{selectedStudent?.name}</h2>
                  <p className="text-sm text-slate-500">Class {selectedStudent?.class}-{selectedStudent?.section} • {selectedStudent?.email}</p>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedStudentPerf && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-500">Overall Score</p>
                  <p className={`text-2xl font-bold ${getScoreColor(selectedStudentPerf.overallScore)}`}>
                    {Math.round(selectedStudentPerf.overallScore)}%
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-500">Tests Taken</p>
                  <p className="text-2xl font-bold text-slate-900">{selectedStudent?.scores.length}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-500">Best Score</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {Math.max(...selectedStudent?.scores.map(s => s.score))}%
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-500">Attendance</p>
                  <p className="text-2xl font-bold text-slate-900">{selectedStudent?.attendance}%</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3">Subject-wise Performance</h4>
                <div className="space-y-3">
                  {Object.entries(selectedStudentPerf.subjectWise || {}).map(([subject, score]) => (
                    <div key={subject} className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 w-40 truncate">{subject}</span>
                      <Progress value={score} className="flex-1 h-2" />
                      <span className={`text-sm font-bold w-12 text-right ${getScoreColor(score)}`}>
                        {Math.round(score)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Areas to Improve ({selectedStudentPerf.weakTopics?.length || 0})
                  </h4>
                  {selectedStudentPerf.weakTopics?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedStudentPerf.weakTopics.map(([topic, score]) => (
                        <Badge key={topic} variant="destructive" className="text-xs">
                          {topic} ({Math.round(score)}%)
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-red-500">No areas to improve</p>
                  )}
                </div>

                <div className="bg-emerald-50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-emerald-700 mb-2 flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Strong Areas ({selectedStudentPerf.strongTopics?.length || 0})
                  </h4>
                  {selectedStudentPerf.strongTopics?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedStudentPerf.strongTopics.map(([topic, score]) => (
                        <Badge key={topic} className="bg-emerald-100 text-emerald-700 text-xs">
                          {topic} ({Math.round(score)}%)
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-500">Keep practicing to build strong areas</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3">Score Trend</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedStudent?.scores.slice(0, 10).reverse().map((s, i, arr) => ({
                      test: `Test ${i + 1}`,
                      score: s.score,
                      avg: Math.round(arr.reduce((a, b) => a + b.score, 0) / arr.length)
                    }))}>
                      <XAxis dataKey="test" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="avg" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
