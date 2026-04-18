/**
 * Student provisioning uses Edge Function `create-user`.
 */
export async function createStudent(supabase, payload) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const row = payload.row || payload;
  const body = {
    role: 'student',
    email: String(row.email || '').trim().toLowerCase(),
    password: row.password || import.meta.env.VITE_DEMO_PASSWORD || '123456',
    fullName: row.name,
    name: row.name,
    schoolId: row.schoolId || row.school_id,
    classId: row.classId || row.class_id,
    rollNo: row.rollNo != null ? String(row.rollNo) : null,
  };
  if (!body.email || !body.schoolId || !body.classId || !body.name) {
    throw new Error('email, schoolId, classId and name are required.');
  }
  const { data, error } = await supabase.functions.invoke('create-user', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.id;
}

export async function deleteStudent(supabase, id) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('delete-user', {
    body: { kind: 'student', id: String(id) },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
