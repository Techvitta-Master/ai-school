/**
 * Resolve app role and ids from Supabase Auth user + profiles + user_roles + teachers/students rows.
 */
export async function resolveCurrentUser(supabase, user) {
  if (!user) return null;

  const env =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env
      : {};
  const email = user.email;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const demoAdminEmail = String(env.VITE_DEMO_EMAIL_ADMIN || 'admin@school.com').trim().toLowerCase();
  const demoSchoolEmail = String(env.VITE_DEMO_EMAIL_SCHOOL || 'school@school.com').trim().toLowerCase();
  const demoTeacherEmail = String(env.VITE_DEMO_EMAIL_TEACHER || 'priya@school.com').trim().toLowerCase();
  const demoStudentEmail = String(env.VITE_DEMO_EMAIL_STUDENT || 'aarav.patel@student.com').trim().toLowerCase();
  const demoSchoolId = 'd0000000-0000-4000-8000-000000000001';
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    email?.split('@')[0];

  const metaRole = user.user_metadata?.role ? String(user.user_metadata.role) : null;

  const authUserId = user.id;

  if (metaRole === 'admin') {
    return { role: 'admin', id: 'admin', name: name || 'School Admin', authUserId };
  }

  const [{ data: roleRows }, { data: profileRow }, { data: teacherByUid }, { data: studentByUid }] =
    await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('profiles').select('role, school_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('teachers').select('id, name, subject').eq('user_id', user.id).maybeSingle(),
      supabase.from('students').select('id, name').eq('user_id', user.id).maybeSingle(),
    ]);

  let schoolName = '';
  if (profileRow?.school_id) {
    const { data: schoolRow } = await supabase.from('schools').select('name').eq('id', profileRow.school_id).maybeSingle();
    schoolName = schoolRow?.name || '';
  }

  const roleFromTable = roleRows?.[0]?.role ? String(roleRows[0].role) : null;
  const profileRole = profileRow?.role ? String(profileRow.role) : null;

  const { data: teacherByEmail } = !teacherByUid
    ? await supabase.from('teachers').select('id, name, subject').eq('email', email).maybeSingle()
    : { data: null };

  const { data: studentByEmail } = !studentByUid
    ? await supabase.from('students').select('id, name').eq('email', email).maybeSingle()
    : { data: null };

  const teacher = teacherByUid || teacherByEmail;
  const student = studentByUid || studentByEmail;

  const role =
    roleFromTable ||
    profileRole ||
    metaRole ||
    (normalizedEmail === demoSchoolEmail ? 'school' : null) ||
    (normalizedEmail === demoAdminEmail ? 'admin' : null) ||
    (normalizedEmail === demoTeacherEmail ? 'teacher' : null) ||
    (normalizedEmail === demoStudentEmail ? 'student' : null) ||
    (teacher ? 'teacher' : student ? 'student' : 'admin');

  if (role === 'school') {
    return {
      role: 'school',
      id: user.id,
      authUserId,
      name: name || 'School',
      schoolId: profileRow?.school_id ?? (normalizedEmail === demoSchoolEmail ? demoSchoolId : null),
      schoolName: schoolName || (normalizedEmail === demoSchoolEmail ? 'Madavi Institute' : ''),
    };
  }

  if (role === 'admin') {
    return { role: 'admin', id: 'admin', name: name || 'School Admin', authUserId };
  }

  if (role === 'teacher') {
    return {
      role: 'teacher',
      id: teacher?.id ?? user.id,
      authUserId,
      name: teacher?.name ?? name ?? 'Teacher',
      subject: teacher?.subject || '',
      schoolId: profileRow?.school_id ?? null,
    };
  }

  if (role === 'student') {
    return {
      role: 'student',
      id: student?.id ?? user.id,
      authUserId,
      name: student?.name ?? name ?? 'Student',
      schoolId: profileRow?.school_id ?? null,
    };
  }

  return { role: 'admin', id: 'admin', name: name || 'School Admin', authUserId };
}
