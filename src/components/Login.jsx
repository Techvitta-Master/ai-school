import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext';
import { GraduationCap, Mail, Lock, Eye, EyeOff, ChevronRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('teacher');
  const { login } = useSchool();
  const navigate = useNavigate();

  const demoEmails = {
    admin: 'admin@school.com',
    teacher: 'priya@school.com',
    student: 'aarav.patel@student.com'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const result = await login(email, password);
    if (result?.success && result.role) navigate(`/${result.role}`);
    else setError('Invalid credentials. Please try again.');
  };

  const fillDemo = (demoRole) => {
    setRole(demoRole);
    setEmail(demoEmails[demoRole] || '');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTJoLTJ2Mmgyem0tNiA2aC0ydi00aDJ2NHptMC02di0yaC0ydjJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">EvalAI</span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
              Transform How You<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-pink-200">
                Evaluate & Track
              </span>
              <br />Student Progress
            </h1>
            <p className="text-lg text-indigo-100 max-w-md">
              AI-powered assessment platform for modern schools. Track performance, identify weaknesses, and drive success.
            </p>
          </div>

          <div className="flex gap-4">
            {[
              { label: 'Schools', value: '500+' },
              { label: 'Teachers', value: '2,500+' },
              { label: 'Students', value: '50K+' }
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-indigo-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-indigo-200">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">Trusted by leading educational institutions</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">EvalAI</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500">Sign in to your account to continue</p>
          </div>

          <Tabs value={role} onValueChange={setRole} className="w-full">
            <TabsList className="grid w-full grid-cols-3 p-1 bg-slate-100 rounded-xl">
              <TabsTrigger value="admin" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Admin
              </TabsTrigger>
              <TabsTrigger value="teacher" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Teacher
              </TabsTrigger>
              <TabsTrigger value="student" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Student
              </TabsTrigger>
            </TabsList>

            <TabsContent value="admin" className="mt-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 space-y-6">
                  <button
                    type="button"
                    onClick={() => fillDemo('admin')}
                    className="w-full py-3 px-4 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                  >
                    Use Admin Demo Account
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teacher" className="mt-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 space-y-6">
                  <button
                    type="button"
                    onClick={() => fillDemo('teacher')}
                    className="w-full py-3 px-4 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                  >
                    Use Teacher Demo Account
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="student" className="mt-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 space-y-6">
                  <button
                    type="button"
                    onClick={() => fillDemo('student')}
                    className="w-full py-3 px-4 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                  >
                    Use Student Demo Account
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
                )}

                <Button type="submit" className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-base font-medium rounded-xl">
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-slate-500">
            By signing in, you agree to our{' '}
            <a href="#" className="text-indigo-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-indigo-600 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
