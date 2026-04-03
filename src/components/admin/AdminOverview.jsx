import { useMemo, useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Users, GraduationCap, FileText, BookOpen, TrendingUp, Award, ArrowRight, Clock, Search, Filter, Download, ChevronDown, ChevronUp, Star, TrendingDown, BarChart3, X, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';

export default function AdminOverview() {
  // Keep both getters available for consistency with other dashboards.
  // `getTeacherPerformance` isn't used in this component, so we alias to avoid lint noise.
  const { data, getStudentPerformance, getTeacherPerformance: _getTeacherPerformance } = useSchool();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const stats = [
    { label: 'Total Teachers', value: data.teachers.length, icon: Users, color: 'blue', trend: '+5 this year' },
    { label: 'Total Students', value: data.students.length, icon: GraduationCap, color: 'emerald', trend: '+40 this year' },
    { label: 'Active Tests', value: data.tests.length, icon: FileText, color: 'purple', trend: 'All chapters' },
    { label: 'Classes', value: data.sections.length, icon: BookOpen, color: 'amber', trend: 'Classes 6-8' },
  ];

  const allStudentsWithPerf = useMemo(() => {
    return data.students.map(s => {
      const perf = getStudentPerformance(s.id);
      return {
        ...s,
        avgScore: perf?.overallScore || 0,
        subjectWise: perf?.subjectWise || {},
        weakTopics: perf?.weakTopics || [],
        strongTopics: perf?.strongTopics || [],
        testCount: s.scores.length
      };
    });
  }, [data, getStudentPerformance]);

  const filteredStudents = useMemo(() => {
    return allStudentsWithPerf
      .filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${s.class}-${s.section}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        let aVal, bVal;
        if (sortBy === 'name') { aVal = a.name; bVal = b.name; }
        else if (sortBy === 'score') { aVal = a.avgScore; bVal = b.avgScore; }
        else if (sortBy === 'class') { aVal = `${a.class}-${a.section}`; bVal = `${b.class}-${b.section}`; }
        return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
      });
  }, [allStudentsWithPerf, searchQuery, sortBy, sortOrder]);

  const topStudents = useMemo(() => {
    return [...allStudentsWithPerf].sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
  }, [allStudentsWithPerf]);

  const weakStudents = useMemo(() => {
    return [...allStudentsWithPerf]
      .filter(s => s.avgScore < 50)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5);
  }, [allStudentsWithPerf]);

  const avgPerformance = useMemo(() => {
    return Math.round(
      allStudentsWithPerf.reduce((a, b) => a + b.avgScore, 0) / (allStudentsWithPerf.length || 1)
    );
  }, [allStudentsWithPerf]);

  const performanceData = useMemo(() => {
    return [
      { month: 'Jan', score: 72 },
      { month: 'Feb', score: 74 },
      { month: 'Mar', score: 71 },
      { month: 'Apr', score: 76 },
      { month: 'May', score: 78 },
      { month: 'Jun', score: avgPerformance },
    ];
  }, [avgPerformance]);

  const classPerformance = useMemo(() => {
    return Object.entries(
      allStudentsWithPerf.reduce((acc, s) => {
        const key = `${s.class}-${s.section}`;
        if (!acc[key]) acc[key] = { total: 0, count: 0 };
        acc[key].total += s.avgScore;
        acc[key].count += 1;
        return acc;
      }, {})
    ).map(([key, val]) => ({ name: key, score: Math.round(val.total / val.count) }));
  }, [allStudentsWithPerf]);

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-amber-100 text-amber-700';
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
          <h1 className="text-2xl font-bold text-slate-900">Welcome back!</h1>
          <p className="text-slate-500 mt-1">Here&apos;s what&apos;s happening at your school</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="animate-fade-in hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  stat.color === 'blue' ? 'bg-blue-100' :
                  stat.color === 'emerald' ? 'bg-emerald-100' :
                  stat.color === 'purple' ? 'bg-purple-100' :
                  'bg-amber-100'
                }`}>
                  <stat.icon className={`w-5 h-5 ${
                    stat.color === 'blue' ? 'text-blue-600' :
                    stat.color === 'emerald' ? 'text-emerald-600' :
                    stat.color === 'purple' ? 'text-purple-600' :
                    'text-amber-600'
                  }`} />
                </div>
                <Badge variant="secondary" className="text-xs">{stat.trend}</Badge>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Performance Overview</h3>
                <p className="text-sm text-slate-500">School performance trend</p>
              </div>
              <Badge className="bg-indigo-100 text-indigo-700">This Year</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[60, 100]} />
                  <Tooltip 
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fill="url(#colorPerf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">School Score</h3>
              <p className="text-sm text-slate-500">Overall average</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                <circle
                  cx="50" cy="50" r="42"
                  stroke="#6366f1" strokeWidth="8" fill="none" strokeLinecap="round"
                  strokeDasharray={`${(avgPerformance / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-slate-900">{avgPerformance}%</span>
                <span className="text-xs text-slate-500">Average</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                All Students Performance
              </h3>
              <p className="text-sm text-slate-500">{filteredStudents.length} students enrolled</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search students..." 
                  className="pl-9 w-48"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name">Sort by Name</option>
                <option value="score">Sort by Score</option>
                <option value="class">Sort by Class</option>
              </select>
              <Button variant="outline" size="icon" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trend</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.slice(0, 25).map((student) => {
                  const trend = student.scores.length > 1 
                    ? student.scores[student.scores.length - 1].score - student.scores[0].score 
                    : 0;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={student.name} className="w-9 h-9" />
                          <div>
                            <p className="font-medium text-slate-900">{student.name}</p>
                            <p className="text-xs text-slate-500">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">Class {student.class}-{student.section}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(student.avgScore)}`}>
                            {Math.round(student.avgScore)}%
                          </span>
                          <Progress value={student.avgScore} className="h-1.5 w-16" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{student.testCount}</td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          <span className="text-sm font-medium">{trend > 0 ? '+' : ''}{trend}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getScoreBg(student.avgScore)}>
                          {student.avgScore >= 80 ? 'Excellent' : student.avgScore >= 60 ? 'Good' : 'Needs Attention'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => handleViewDetails(student)}
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
          {filteredStudents.length > 25 && (
            <div className="p-4 text-center border-t border-slate-200">
              <p className="text-sm text-slate-500">Showing 25 of {filteredStudents.length} students</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Top Performers
                </h3>
                <p className="text-sm text-slate-500">Highest scoring students</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topStudents.map((student, i) => (
                <div key={student.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewDetails(student)}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                    i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-600' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {i + 1}
                  </div>
                  <Avatar name={student.name} className="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{student.name}</p>
                    <p className="text-xs text-slate-500">Class {student.class}-{student.section}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${getScoreColor(student.avgScore)}`}>{Math.round(student.avgScore)}%</p>
                    <Progress value={student.avgScore} className="h-1.5 w-16 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  Needs Attention
                </h3>
                <p className="text-sm text-slate-500">Students below 50%</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {weakStudents.length > 0 ? (
              <div className="space-y-3">
                {weakStudents.map((student) => (
                  <div key={student.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewDetails(student)}>
                    <Avatar name={student.name} className="w-10 h-10" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{student.name}</p>
                      <p className="text-xs text-slate-500">Class {student.class}-{student.section}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{Math.round(student.avgScore)}%</p>
                      <Button variant="ghost" size="sm" className="h-6 text-xs">Help</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">All students are performing well!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Class Performance</h3>
              <p className="text-sm text-slate-500">Average scores by class section</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classPerformance}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                />
                <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                    {Math.max(...(selectedStudent?.scores?.map(s => s.score) || [0]))}%
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
