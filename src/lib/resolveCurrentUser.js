/**
 * Resolve app role and ids from Supabase Auth user + user_roles + teachers/students rows.
 */
export async function resolveCurrentUser(supabase, user) {
  if (!user) return null;

  const email = user.email;
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    email?.split('@')[0];

  const metaRole = user.user_metadata?.role ? String(user.user_metadata.role) : null;

  if (metaRole === 'admin') {
    return { role: 'admin', id: 'admin', name: name || 'School Admin' };
  }

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const roleFromTable = roleRows?.[0]?.role ? String(roleRows[0].role) : null;

  const { data: teacherByUid } = await supabase
    .from('teachers')
    .select('id, name, subject')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: studentByUid } = await supabase
    .from('students')
    .select('id, name')
    .eq('user_id', user.id)
    .maybeSingle();

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
    metaRole ||
    (teacher ? 'teacher' : student ? 'student' : 'admin');

  if (role === 'admin') {
    return { role: 'admin', id: 'admin', name: name || 'School Admin' };
  }

  if (role === 'teacher' && teacher) {
    return {
      role: 'teacher',
      id: teacher.id,
      name: teacher.name,
      subject: teacher.subject || '',
    };
  }

  if (role === 'student' && student) {
    return { role: 'student', id: student.id, name: student.name };
  }

  if (teacher) {
    return {
      role: 'teacher',
      id: teacher.id,
      name: teacher.name,
      subject: teacher.subject || '',
    };
  }

  if (student) {
    return { role: 'student', id: student.id, name: student.name };
  }

  // Match legacy demo behavior: unknown users default to admin (restrict in production via user_roles).
  return { role: 'admin', id: 'admin', name: name || 'School Admin' };
}
