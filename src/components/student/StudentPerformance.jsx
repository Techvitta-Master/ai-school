import { useSchool } from '../../context/SchoolContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { BookOpen, Target, Award, TrendingUp } from 'lucide-react';

export default function StudentPerformance() {
  const { currentUser, getStudentPerformance } = useSchool();
  
  const perf = getStudentPerformance(currentUser.id);

  const subjectData = Object.entries(perf?.subjectWise || {}).map(([name, score]) => ({
    name: name.split(' ')[0],
    score: Math.round(score)
  }));

  const topicData = Object.entries(perf?.topicWise || {})
    .map(([topic, score]) => ({
      topic: topic.length > 20 ? topic.substring(0, 20) + '...' : topic,
      fullTopic: topic,
      score: Math.round(score)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const radarData = Object.entries(perf?.subjectWise || {}).map(([subject, score]) => ({
    subject: subject.split(' ')[0],
    value: Math.round(score),
    fullMark: 100
  }));

  const testData = Object.entries(perf?.testWise || {})
    .map(([test, score]) => ({
      test: test.length > 25 ? test.substring(0, 25) + '...' : test,
      score: Math.round(score)
    }))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Overall Performance', value: `${Math.round(perf?.overallScore || 0)}%`, icon: TrendingUp, color: 'purple' },
          { label: 'Strongest Subject', value: perf?.strongTopics?.[0]?.[0]?.split(' ')[0] || 'N/A', icon: Award, color: 'emerald' },
          { label: 'Tests Analyzed', value: Object.keys(perf?.testWise || {}).length, icon: BookOpen, color: 'indigo' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 bg-${color}-100 rounded-xl flex items-center justify-center`}>
                <Icon className={`w-6 h-6 text-${color}-600`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject-wise Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Radar</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Score" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Topic Performance</h3>
        <div className="space-y-3">
          {topicData.map(t => (
            <div key={t.topic} className="flex items-center gap-4">
              <div className="w-48 text-sm text-gray-600 truncate" title={t.fullTopic}>{t.topic}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    t.score >= 70 ? 'bg-green-500' : t.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${t.score}%` }}
                />
              </div>
              <div className="w-12 text-sm font-medium text-gray-900">{t.score}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test-wise Scores</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={testData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis dataKey="test" type="category" tick={{ fontSize: 10 }} width={150} />
              <Tooltip />
              <Bar dataKey="score" fill="#6366f1" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
