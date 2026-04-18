/**
 * Resolve app role and ids from new normalized schema:
 * users, schools, subjects, teachers, students, classes.
 */
export async function resolveCurrentUser(supabase, user) {
  if (!user) return null;

  const email = user.email;
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    email?.split('@')[0];

  const authUserId = user.id;
  const [{ data: userRow }, { data: teacherByUid }, { data: studentByUid }] = await Promise.all([
    supabase.from('users').select('id, email, role').eq('id', user.id).maybeSingle(),
    supabase
      .from('teachers')
      .select('id, name, school_id, subject_id, subjects(name)')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('students')
      .select('id, name, school_id, class_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const role = String(userRow?.role || user.user_metadata?.role || '').toLowerCase();

  if (role === 'school') {
    let { data: schoolRow } = await supabase
      .from('schools')
      .select('id, name')
      .eq('created_by', user.id)
      .maybeSingle();
    if (!schoolRow) {
      const { data: schools } = await supabase.from('schools').select('id, name').order('created_at');
      if ((schools || []).length === 1) {
        schoolRow = schools[0];
      }
    }
    return {
      role: 'school',
      id: user.id,
      authUserId,
      email,
      name: name || 'School',
      schoolId: schoolRow?.id ?? null,
      schoolName: schoolRow?.name ?? '',
    };
  }

  if (role === 'admin') {
    return { role: 'admin', id: 'admin', name: name || 'School Admin', authUserId, email };
  }

  if (role === 'teacher') {
    return {
      role: 'teacher',
      id: teacherByUid?.id ?? user.id,
      authUserId,
      email,
      name: teacherByUid?.name ?? name ?? 'Teacher',
      subject: teacherByUid?.subjects?.name || '',
      subjectId: teacherByUid?.subject_id ?? null,
      schoolId: teacherByUid?.school_id ?? null,
    };
  }

  if (role === 'student') {
    return {
      role: 'student',
      id: studentByUid?.id ?? user.id,
      authUserId,
      email,
      name: studentByUid?.name ?? name ?? 'Student',
      schoolId: studentByUid?.school_id ?? null,
      classId: studentByUid?.class_id ?? null,
    };
  }

  return { role: 'admin', id: 'admin', name: name || 'School Admin', authUserId, email };
}
