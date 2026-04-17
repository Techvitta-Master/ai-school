import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const demoPassword = process.env.VITE_DEMO_PASSWORD || '123456';
const users = [
  {
    email: process.env.VITE_DEMO_EMAIL_ADMIN || 'admin@school.com',
    role: 'admin',
    fullName: 'School Admin',
  },
  {
    email: process.env.VITE_DEMO_EMAIL_SCHOOL || 'school@school.com',
    role: 'school',
    fullName: 'Madavi School Admin',
  },
  {
    email: process.env.VITE_DEMO_EMAIL_TEACHER || 'priya@school.com',
    role: 'teacher',
    fullName: 'Priya Sharma',
  },
  {
    email: process.env.VITE_DEMO_EMAIL_STUDENT || 'aarav.patel@student.com',
    role: 'student',
    fullName: 'Aarav Patel',
  },
];

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser({ email, role, fullName }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;

  const existing = (list.data?.users || []).find(
    (u) => String(u.email || '').toLowerCase() === normalizedEmail
  );

  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password: demoPassword,
      email_confirm: true,
      user_metadata: { role, full_name: fullName },
    });
    if (updated.error) throw updated.error;
    console.log(`updated: ${normalizedEmail}`);
    return;
  }

  const created = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (created.error) throw created.error;
  console.log(`created: ${normalizedEmail}`);
}

try {
  for (const u of users) {
    await ensureUser(u);
  }
  console.log('Auth seed complete.');
} catch (err) {
  console.error('Auth seed failed:', err?.message || err);
  process.exit(1);
}
