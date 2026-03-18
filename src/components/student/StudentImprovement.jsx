import { useSchool } from '../../context/SchoolContext';
import { TrendingUp, AlertTriangle, CheckCircle, BookOpen, Target, Lightbulb } from 'lucide-react';

export default function StudentImprovement() {
  const { currentUser, data, getStudentPerformance } = useSchool();
  
  const perf = getStudentPerformance(currentUser.id);

  const weakTopics = perf?.weakTopics || [];
  const strongTopics = perf?.strongTopics || [];

  const topicDetails = weakTopics.map(([topic, score]) => {
    const chapter = data.syllabus.themes.flatMap(t => t.chapters).find(c => 
      c.topics.includes(topic)
    );
    const theme = data.syllabus.themes.find(t => 
      t.chapters.some(c => c.chapter_number === chapter?.chapter_number)
    );
    return {
      topic,
      score: Math.round(score),
      chapter: chapter?.title || 'Unknown',
      chapterNumber: chapter?.chapter_number,
      theme: theme?.title || 'Unknown'
    };
  });

  const recommendations = [
    { 
      icon: BookOpen, 
      title: 'Study Resources', 
      desc: 'Focus on NCERT textbook chapters related to weak topics'
    },
    { 
      icon: Target, 
      title: 'Practice More', 
      desc: 'Solve additional questions from topics with scores below 50%'
    },
    { 
      icon: Lightbulb, 
      title: 'Get Help', 
      desc: 'Schedule a doubt session with your teacher for difficult concepts'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Target className="w-6 h-6" />
          <h2 className="text-xl font-semibold">Areas for Improvement</h2>
        </div>
        <p className="text-amber-100">
          Focus on these topics to improve your overall performance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Topics Needing Attention</h3>
                <p className="text-sm text-gray-500">Score below 50% - requires more focus</p>
              </div>
            </div>
            
            {topicDetails.length > 0 ? (
              <div className="space-y-4">
                {topicDetails.map((item, i) => (
                  <div key={i} className="p-4 bg-red-50 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.topic}</h4>
                        <p className="text-sm text-gray-500">
                          Chapter {item.chapterNumber}: {item.chapter} • {item.theme}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-red-100 text-red-600 font-semibold rounded-full">
                        {item.score}%
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="h-2 bg-red-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">Great job! You're performing well in all topics.</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Strong Topics</h3>
                <p className="text-sm text-gray-500">Keep up the good work!</p>
              </div>
            </div>
            
            {strongTopics.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {strongTopics.map(([topic, score]) => (
                  <div key={topic} className="p-3 bg-green-50 rounded-xl flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{topic}</span>
                    <span className="px-2 py-1 bg-green-100 text-green-600 text-sm font-semibold rounded-full">
                      {Math.round(score)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Work on more topics to build strengths!</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Recommendations</h3>
            <div className="space-y-4">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <rec.icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{rec.title}</p>
                    <p className="text-xs text-gray-500">{rec.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Tips</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">•</span>
                Review topics for 15-20 minutes daily
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">•</span>
                Practice previous year questions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">•</span>
                Make flashcards for important terms
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">•</span>
                Attend doubt sessions regularly
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">•</span>
                Take short breaks between study sessions
              </li>
            </ul>
          </div>

          <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
            <h3 className="font-semibold text-indigo-900 mb-2">Target Score</h3>
            <p className="text-3xl font-bold text-indigo-600 mb-1">85%</p>
            <p className="text-sm text-indigo-600">
              {perf?.overallScore >= 85 
                ? "You've reached your target! Keep it up!" 
                : `${85 - Math.round(perf?.overallScore || 0)}% more to reach your target`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
