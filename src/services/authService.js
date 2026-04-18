/**
 * Client-side Supabase Auth helpers (no Express).
 */
export async function signInWithPassword(supabase, email, password) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const normalized = String(email || '').trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password: String(password || ''),
  });
  if (error) throw error;
  return data;
}

export async function signOutLocal(supabase) {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: 'local' });
}
