/**
 * Teacher provisioning uses Edge Function `create-user` (service role + Auth Admin).
 */
export async function createTeacher(supabase, payload) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const body = {
    role: 'teacher',
    email: String(payload.email || '').trim().toLowerCase(),
    password: payload.password || import.meta.env.VITE_DEMO_PASSWORD || '123456',
    fullName: payload.name,
    name: payload.name,
    schoolId: payload.schoolId ?? payload.school_id,
    subjectId: payload.subjectId ?? payload.subject_id,
  };
  if (!body.email || !body.schoolId || !body.subjectId || !body.name) {
    throw new Error('name, email, schoolId and subjectId are required.');
  }
  const { data, error } = await supabase.functions.invoke('create-user', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.id;
}

export async function deleteTeacher(supabase, id) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('delete-user', {
    body: { kind: 'teacher', id: String(id) },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
