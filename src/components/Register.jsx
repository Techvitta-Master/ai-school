import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { isApiLayerEnabled } from '../lib/apiConfig';
import { fetchSchoolsList } from '../lib/schoolApi';
import { REGISTRATION_SCHOOLS } from '../lib/registrationSchools';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [schoolId, setSchoolId] = useState('');
  const [schoolOptions, setSchoolOptions] = useState(REGISTRATION_SCHOOLS);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isApiLayerEnabled()) {
        try {
          const data = await fetchSchoolsList();
          if (cancelled) return;
          if (data?.length) {
            setSchoolOptions(data.map((r) => ({ id: r.id, name: r.name })));
          } else {
            setSchoolOptions(REGISTRATION_SCHOOLS);
          }
        } catch {
          if (!cancelled) setSchoolOptions(REGISTRATION_SCHOOLS);
        }
        return;
      }
      if (!supabase) return;
      const { data, error: fetchErr } = await supabase.from('schools').select('id,name').order('name');
      if (cancelled) return;
      if (!fetchErr && data?.length) {
        setSchoolOptions(data.map((r) => ({ id: r.id, name: r.name })));
      } else {
        setSchoolOptions(REGISTRATION_SCHOOLS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const needsSchool = role === 'teacher' || role === 'student' || role === 'school';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!supabase) {
      setError('Supabase is not configured. Please contact your administrator.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (needsSchool && !schoolId) {
      setError('Please select a school.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const meta = {
        full_name: fullName.trim(),
        role,
        ...(needsSchool ? { school_id: schoolId } : {}),
      };

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: meta,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setPassword('');
      setConfirmPassword('');

      navigate('/login', {
        replace: true,
        state: {
          successMessage: 'Account created successfully. Please sign in.',
        },
      });
    } catch (err) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">EvalAI</span>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
              <p className="text-sm text-slate-500">Register to access your school dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Full name</label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <Select value={role} onValueChange={(v) => { setRole(v); setSchoolId(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {needsSchool && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">School</label>
                  <Select value={schoolId} onValueChange={setSchoolId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Only these registered schools are available for signup.</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Confirm password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

              <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700">
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <p className="text-sm text-center text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
