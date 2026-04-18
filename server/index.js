/**
 * Thin API layer: Express forwards the user's Supabase JWT to PostgREST so RLS is unchanged.
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as repo from '../src/lib/schoolRepository.js';
import { buildEvaluation } from '../src/lib/evaluationService.js';
import { resolveCurrentUser } from '../src/lib/resolveCurrentUser.js';
import { createUserSupabase, createAnonSupabase, createServiceSupabase } from './supabaseUser.js';
import { checkSupabaseReachable, logSupabaseStartupCheck } from './dbHealth.js';

const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 8787);
const DEFAULT_PORTAL_PASSWORD = process.env.VITE_DEMO_PASSWORD || '123456';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.UPLOAD_MAX_BYTES || '10485760', 10) },
});

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

function getBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseClassNumber(value) {
  const s = String(value ?? '').trim();
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : NaN;
}

async function findClassRowByInput(db, schoolId, classInput) {
  const raw = String(classInput || '').trim();
  const classNum = parseClassNumber(raw);

  const { data: rows, error } = await db.from('classes').select('id, school_id, name').eq('school_id', schoolId);
  if (error) throw error;
  const list = rows || [];

  let row = list.find((r) => String(r.name).trim().toLowerCase() === raw.toLowerCase());
  if (row) return row;

  if (Number.isFinite(classNum)) {
    row = list.find((r) => parseClassNumber(r.name) === classNum);
    if (row) return row;
  }
  return null;
}

async function findAuthUserByEmail(service, email) {
  const normalized = normalizeEmail(email);
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((u) => normalizeEmail(u.email) === normalized);
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }
  return null;
}

async function ensurePortalAuthUser(service, { email, role, fullName }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Email is required.');
  let created = false;
  let user = null;

  const createRes = await service.auth.admin.createUser({
    email: normalizedEmail,
    password: DEFAULT_PORTAL_PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName || null },
  });
  if (!createRes.error && createRes.data?.user) {
    user = createRes.data.user;
    created = true;
  } else if (createRes.error) {
    const existing = await findAuthUserByEmail(service, normalizedEmail);
    if (!existing) {
      throw createRes.error;
    }
    const updateRes = await service.auth.admin.updateUserById(existing.id, {
      password: DEFAULT_PORTAL_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        role,
        full_name: fullName || existing.user_metadata?.full_name || null,
      },
    });
    if (updateRes.error) throw updateRes.error;
    user = updateRes.data?.user || existing;
  }

  if (!user?.id) throw new Error('Failed to provision auth user.');
  return { userId: user.id, created };
}

async function upsertPortalIdentity(service, { userId, email, role }) {
  const payload = {
    id: userId,
    email: normalizeEmail(email),
    role,
  };
  const { error } = await service.from('users').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function ensureTableUserLink(service, { role, rowId, userId }) {
  const table = role === 'teacher' ? 'teachers' : role === 'student' ? 'students' : null;
  if (!table || !rowId || !userId) return;
  const { error } = await service.from(table).update({ user_id: userId }).eq('id', rowId);
  if (error) throw error;
}

async function ensurePortalIdentityForExistingEmail(service, { role, email, fullName }) {
  const normalized = normalizeEmail(email);
  if (!normalized || !['teacher', 'student'].includes(role)) return { linked: false };
  const table = role === 'teacher' ? 'teachers' : 'students';
  const { data: row, error: rowErr } = await service
    .from(table)
    .select('id, name, email, school_id, user_id')
    .eq('email', normalized)
    .maybeSingle();
  if (rowErr || !row) return { linked: false };
  if (row.user_id) return { linked: false };

  const resolvedName = fullName || row.name || normalized.split('@')[0];
  const { userId } = await ensurePortalAuthUser(service, {
    email: normalized,
    role,
    fullName: resolvedName,
  });
  await upsertPortalIdentity(service, {
    userId,
    email: normalized,
    fullName: resolvedName,
    role,
    schoolId: row.school_id ?? null,
  });
  await ensureTableUserLink(service, { role, rowId: row.id, userId });
  return { linked: true };
}

async function requireUserSupabase(req, res) {
  const token = getBearer(req);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token.' });
    return null;
  }
  const supabase = createUserSupabase(token);
  return { supabase, token };
}

/** Admin-only: highest role in portal hierarchy (admin > school > teacher > student). */
async function requireAdmin(req, res) {
  const ctx = await requireUserSupabase(req, res);
  if (!ctx) return null;
  const { supabase } = ctx;
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return null;
  }
  const service = createServiceSupabase();
  const resolved = await resolveCurrentUser(service, user);
  if (resolved?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return null;
  }
  return { ...ctx, user, resolved };
}

/** Fast liveness (no external calls). */
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** Readiness: confirms env + PostgREST reachability (same path the app uses instead of raw Postgres). */
app.get('/api/health', async (_req, res) => {
  const supabase = await checkSupabaseReachable();
  res.json({
    ok: true,
    supabase: supabase.ok ? 'reachable' : supabase.reason === 'missing_env' ? 'missing_env' : 'unreachable',
  });
});

/** Email/password login via API (for frontend -> backend auth flow). */
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    // Auto-heal for legacy rows created before auth-provisioning existed:
    // if a teacher/student row exists for this email but no auth account/user_id link,
    // create/link it so login can proceed with the default password.
    if (password === DEFAULT_PORTAL_PASSWORD) {
      try {
        const service = createServiceSupabase();
        await ensurePortalIdentityForExistingEmail(service, { role: 'teacher', email });
        await ensurePortalIdentityForExistingEmail(service, { role: 'student', email });
      } catch (healErr) {
        console.warn('[api] login auto-heal skipped:', healErr?.message || healErr);
      }
    }

    const anon = createAnonSupabase();
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signInData?.session?.access_token || !signInData?.session?.refresh_token) {
      res.status(401).json({ error: signInError?.message || 'Invalid credentials.' });
      return;
    }

    const userSupabase = createUserSupabase(signInData.session.access_token);
    const {
      data: { user },
      error: userErr,
    } = await userSupabase.auth.getUser();
    if (userErr || !user) {
      res.status(401).json({ error: 'Unable to resolve authenticated user.' });
      return;
    }

    const service = createServiceSupabase();
    const resolved = await resolveCurrentUser(service, user);
    res.json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      user: resolved,
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'login failed' });
  }
});

/** Resolve app role (same as client `resolveCurrentUser`). */
app.get('/api/me', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { supabase } = ctx;
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return;
    }
    const service = createServiceSupabase();
    const resolved = await resolveCurrentUser(service, user);
    res.json(resolved);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'resolve failed' });
  }
});

/** Schools list for registration — uses anon key; RLS allows public read. */
app.get('/api/schools', async (_req, res) => {
  try {
    const db = createServiceSupabase();
    const { data, error } = await db.from('schools').select('id,name,created_at').order('created_at');
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'failed to load schools' });
  }
});

app.post('/api/schools', async (req, res) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const payload = req.body || {};
    const row = await repo.insertSchool(db, payload);
    const schoolAdminEmail = normalizeEmail(payload.schoolAdminEmail);
    if (schoolAdminEmail) {
      const service = createServiceSupabase();
      const schoolAdminName = String(payload.schoolAdminName || `${row.name} Admin`).trim();
      const { userId, created } = await ensurePortalAuthUser(service, {
        email: schoolAdminEmail,
        role: 'school',
        fullName: schoolAdminName,
      });
      try {
        await upsertPortalIdentity(service, {
          userId,
          email: schoolAdminEmail,
          fullName: schoolAdminName,
          role: 'school',
        });
        const { error: schoolOwnerErr } = await service.from('schools').update({ created_by: userId }).eq('id', row.id);
        if (schoolOwnerErr) throw schoolOwnerErr;
      } catch (err) {
        if (created) {
          await service.auth.admin.deleteUser(userId);
        }
        throw err;
      }
    }
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err?.message || 'failed to create school' });
  }
});

app.delete('/api/schools/:id', async (req, res) => {
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    await repo.deleteSchool(db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'failed to delete school' });
  }
});

app.post('/api/school-data', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const schoolId = req.body?.schoolId ?? null;
    const classQ = db.from('classes').select('id, school_id, name');
    const subjectQ = db.from('subjects').select('id, school_id, name');
    const teacherQ = db.from('teachers').select('id, school_id, subject_id, user_id, name, email');
    const studentQ = db.from('students').select('id, school_id, class_id, user_id, name, email, roll_no');
    const [{ data: classes, error: cErr }, { data: subjects, error: subErr }, { data: teachers, error: tErr }, { data: students, error: stErr }, { data: tests, error: teErr }, { data: results, error: rErr }, { data: teacherClasses, error: tcErr }] = await Promise.all([
      schoolId ? classQ.eq('school_id', schoolId) : classQ,
      schoolId ? subjectQ.eq('school_id', schoolId) : subjectQ,
      schoolId ? teacherQ.eq('school_id', schoolId) : teacherQ,
      schoolId ? studentQ.eq('school_id', schoolId) : studentQ,
      db.from('tests').select('id, name, subject_id, class_id, created_by, created_at'),
      db.from('results').select('id, student_id, test_id, marks, percentage, created_at'),
      db.from('teacher_classes').select('id, teacher_id, class_id, created_at'),
    ]);
    const err = cErr || subErr || tErr || stErr || teErr || rErr || tcErr;
    if (err) throw err;
    res.json({
      classes: classes || [],
      subjects: subjects || [],
      teachers: teachers || [],
      students: students || [],
      tests: tests || [],
      results: results || [],
      teacher_classes: teacherClasses || [],
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'loadSchoolData failed' });
  }
});

app.post('/api/teachers', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const payload = req.body || {};
    const email = normalizeEmail(payload.email);
    if (!email) {
      res.status(400).json({ error: 'Teacher email is required.' });
      return;
    }
    const service = createServiceSupabase();
    const { userId, created } = await ensurePortalAuthUser(service, {
      email,
      role: 'teacher',
      fullName: payload.name,
    });
    let id = null;
    try {
      await upsertPortalIdentity(service, {
        userId,
        email,
        fullName: payload.name,
        role: 'teacher',
      });
      const teacherPayload = {
        user_id: userId,
        school_id: payload.schoolId ?? payload.school_id ?? null,
        subject_id: payload.subjectId ?? payload.subject_id ?? null,
        name: payload.name,
        email,
      };
      if (!teacherPayload.school_id || !teacherPayload.subject_id || !teacherPayload.name) {
        throw new Error('name, schoolId and subjectId are required.');
      }
      const { data, error } = await db.from('teachers').insert(teacherPayload).select('id').single();
      if (error) throw error;
      id = data.id;
    } catch (err) {
      if (created) {
        await service.auth.admin.deleteUser(userId);
      }
      throw err;
    }
    res.json({ id });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertTeacher failed' });
  }
});

app.delete('/api/teachers/:id', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    await repo.deleteTeacher(ctx.supabase, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'deleteTeacher failed' });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const row = req.body?.row || req.body;
    const email = normalizeEmail(row.email);
    if (!email) {
      res.status(400).json({ error: 'Student email is required.' });
      return;
    }
    const schoolId = row.schoolId || row.school_id;
    if (!schoolId) {
      res.status(400).json({ error: 'schoolId is required.' });
      return;
    }
    const service = createServiceSupabase();
    const { userId, created } = await ensurePortalAuthUser(service, {
      email,
      role: 'student',
      fullName: row.name,
    });
    let id = null;
    try {
      await upsertPortalIdentity(service, {
        userId,
        email,
        fullName: row.name,
        role: 'student',
      });
      const classId = row.classId || row.class_id;
      if (!classId) throw new Error('classId is required.');
      const payload = {
        user_id: userId,
        school_id: schoolId,
        class_id: classId,
        name: row.name,
        email,
        roll_no: row.rollNo != null ? String(row.rollNo) : null,
      };
      const { data, error } = await db.from('students').insert(payload).select('id').single();
      if (error) throw error;
      id = data.id;
    } catch (err) {
      if (created) {
        await service.auth.admin.deleteUser(userId);
      }
      throw err;
    }
    res.json({ id });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertStudent failed' });
  }
});

app.patch('/api/students/:id', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const row = req.body?.row || req.body;
    const schoolId = row.schoolId || row.school_id;
    if (!schoolId) {
      res.status(400).json({ error: 'schoolId is required.' });
      return;
    }
    const payload = {
      name: row.name,
      email: row.email,
      class_id: row.classId || row.class_id,
      school_id: schoolId,
      roll_no: row.rollNo != null ? String(row.rollNo) : null,
    };
    const { error } = await db.from('students').update(payload).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'updateStudent failed' });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    await repo.deleteStudent(ctx.supabase, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'deleteStudent failed' });
  }
});

app.post('/api/classes', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { className, schoolId } = req.body || {};
    if (!schoolId || !className) {
      res.status(400).json({ error: 'schoolId and className are required.' });
      return;
    }
    const { data, error } = await db
      .from('classes')
      .upsert({ school_id: schoolId, name: String(className).trim() }, { onConflict: 'school_id,name' })
      .select('id, school_id, name')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertClass failed' });
  }
});

async function updateSchoolClassRoute(req, res) {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const classId = req.params.id;
    const { className, schoolId } = req.body || {};
    if (!schoolId || !className) {
      res.status(400).json({ error: 'schoolId and className are required.' });
      return;
    }
    const { data: row, error: rowErr } = await db
      .from('classes')
      .select('id, school_id')
      .eq('id', classId)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row || row.school_id !== schoolId) {
      res.status(404).json({ error: 'Class not found in this school.' });
      return;
    }
    const { error } = await db
      .from('classes')
      .update({ name: String(className).trim() })
      .eq('id', classId)
      .eq('school_id', schoolId);
    if (error) throw error;
    res.json({ ok: true, id: classId });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'updateClass failed' });
  }
}

app.patch('/api/classes/:id', updateSchoolClassRoute);
app.put('/api/classes/:id', updateSchoolClassRoute);

app.delete('/api/classes/:id', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const classId = req.params.id;
    const schoolId = req.query.schoolId;
    if (!schoolId) {
      res.status(400).json({ error: 'schoolId query param is required.' });
      return;
    }
    const { data: row, error: rowErr } = await db
      .from('classes')
      .select('id, school_id')
      .eq('id', classId)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row || row.school_id !== schoolId) {
      res.status(404).json({ error: 'Class not found in this school.' });
      return;
    }
    const { error } = await db.from('classes').delete().eq('id', classId).eq('school_id', schoolId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'deleteClass failed' });
  }
});

app.get('/api/class-id-map', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const schoolId = req.query.schoolId;
    if (!schoolId) {
      res.status(400).json({ error: 'schoolId query param is required.' });
      return;
    }
    const { data, error } = await db.from('classes').select('id, name').eq('school_id', schoolId);
    if (error) throw error;
    const out = {};
    for (const row of data || []) out[String(row.name)] = row.id;
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err?.message || 'fetchClassIdMap failed' });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { schoolId, name } = req.body || {};
    if (!schoolId || !name) {
      res.status(400).json({ error: 'schoolId and name are required.' });
      return;
    }
    const { data, error } = await db
      .from('subjects')
      .upsert({ school_id: schoolId, name: String(name).trim() }, { onConflict: 'school_id,name' })
      .select('id, school_id, name')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err?.message || 'create subject failed' });
  }
});

app.post('/api/teacher-class-assignments', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { teacherId, className, subject, schoolId } = req.body || {};
    if (!teacherId || !className || !subject || !schoolId) {
      res.status(400).json({ error: 'teacherId, className, subject, schoolId are required.' });
      return;
    }

    const { data: teacher, error: tErr } = await db
      .from('teachers')
      .select('id, school_id, subject_id')
      .eq('id', teacherId)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!teacher) throw new Error('Teacher not found in this school.');

    const classRow = await findClassRowByInput(db, schoolId, className);
    if (!classRow) throw new Error('Class not found.');

    const { data: subjectRow, error: sErr } = await db
      .from('subjects')
      .select('id, school_id, name')
      .eq('school_id', schoolId)
      .eq('name', String(subject).trim())
      .maybeSingle();
    if (sErr) throw sErr;
    if (!subjectRow) throw new Error('Subject not found.');

    if (teacher.subject_id !== subjectRow.id) {
      res.status(400).json({ error: 'Teacher can only be assigned to their own subject.' });
      return;
    }

    const { data: link, error: linkErr } = await db
      .from('teacher_classes')
      .upsert(
        {
          teacher_id: teacher.id,
          class_id: classRow.id,
        },
        { onConflict: 'teacher_id,class_id' }
      )
      .select('id, teacher_id, class_id')
      .single();
    if (linkErr) throw linkErr;

    res.json({
      ok: true,
      assignment: {
        teacherId: teacher.id,
        classId: classRow.id,
        className: classRow.name,
        subjectId: subjectRow.id,
        subjectName: subjectRow.name,
        linkId: link.id,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertTeacherClassAssignment failed' });
  }
});

app.patch('/api/teacher-class-assignments', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { oldTeacherId, newTeacherId, className, subject, schoolId } = req.body || {};
    if (!oldTeacherId || !newTeacherId || !className || !subject || !schoolId) {
      res.status(400).json({ error: 'oldTeacherId, newTeacherId, className, subject, schoolId are required.' });
      return;
    }

    const classRow = await findClassRowByInput(db, schoolId, className);
    if (!classRow) throw new Error('Class not found.');

    const { data: subjectRow, error: sErr } = await db
      .from('subjects')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', String(subject).trim())
      .maybeSingle();
    if (sErr) throw sErr;
    if (!subjectRow) throw new Error('Subject not found.');

    const { data: oldTeacher, error: oldErr } = await db
      .from('teachers')
      .select('id, subject_id')
      .eq('id', oldTeacherId)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (oldErr) throw oldErr;
    if (!oldTeacher || oldTeacher.subject_id !== subjectRow.id) {
      throw new Error('Old teacher assignment not valid for this subject.');
    }

    const { data: newTeacher, error: newErr } = await db
      .from('teachers')
      .select('id, subject_id')
      .eq('id', newTeacherId)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (newErr) throw newErr;
    if (!newTeacher || newTeacher.subject_id !== subjectRow.id) {
      throw new Error('New teacher must have the same subject.');
    }

    const { error: delErr } = await db
      .from('teacher_classes')
      .delete()
      .eq('teacher_id', oldTeacherId)
      .eq('class_id', classRow.id);
    if (delErr) throw delErr;

    const { data: link, error: linkErr } = await db
      .from('teacher_classes')
      .upsert(
        {
          teacher_id: newTeacherId,
          class_id: classRow.id,
        },
        { onConflict: 'teacher_id,class_id' }
      )
      .select('id, teacher_id, class_id')
      .single();
    if (linkErr) throw linkErr;

    res.json({
      ok: true,
      assignment: {
        oldTeacherId,
        newTeacherId,
        classId: classRow.id,
        className: String(className).trim(),
        subjectId: subjectRow.id,
        subjectName: String(subject).trim(),
        linkId: link.id,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'updateTeacherClassAssignmentTeacher failed' });
  }
});

app.post('/api/tests', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { testInput, createdByTeacherId } = req.body || {};
    const testName = String(testInput?.name || '').trim();
    const classId = testInput?.classId || testInput?.class_id;
    let subjectId = testInput?.subjectId || testInput?.subject_id || null;
    const teacherId = createdByTeacherId ?? null;
    if (!testName || !classId || !teacherId) {
      res.status(400).json({ error: 'name, classId and createdByTeacherId are required.' });
      return;
    }

    const { data: teacher, error: teacherErr } = await db
      .from('teachers')
      .select('id, subject_id')
      .eq('id', teacherId)
      .maybeSingle();
    if (teacherErr) throw teacherErr;
    if (!teacher) throw new Error('Teacher not found.');

    if (!subjectId) subjectId = teacher.subject_id;
    if (teacher.subject_id !== subjectId) {
      res.status(403).json({ error: 'Teacher can only create tests for their subject.' });
      return;
    }

    const { data, error } = await db
      .from('tests')
      .insert({
        name: testName,
        subject_id: subjectId,
        class_id: classId,
        created_by: teacherId,
      })
      .select('id')
      .single();
    if (error) throw error;
    const id = data.id;
    res.json({ id });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'createTestRecord failed' });
  }
});

app.delete('/api/tests/:id', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const testId = req.params.id;
    const { error: resultsErr } = await db.from('results').delete().eq('test_id', testId);
    if (resultsErr) throw resultsErr;
    await repo.deleteTest(db, testId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'deleteTest failed' });
  }
});

app.post('/api/scores', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { studentId, testId, scoreData } = req.body || {};
    if (!studentId || !testId) {
      res.status(400).json({ error: 'studentId and testId are required.' });
      return;
    }
    const marks = Number(scoreData?.marks ?? scoreData?.score);
    if (!Number.isFinite(marks)) {
      res.status(400).json({ error: 'marks must be numeric.' });
      return;
    }
    const percentage =
      scoreData?.percentage != null && scoreData?.percentage !== '' ? Number(scoreData.percentage) : null;

    const { data: student, error: studentErr } = await db
      .from('students')
      .select('id, class_id')
      .eq('id', studentId)
      .maybeSingle();
    if (studentErr) throw studentErr;
    if (!student) throw new Error('Student not found.');

    const { data: test, error: testErr } = await db
      .from('tests')
      .select('id, class_id')
      .eq('id', testId)
      .maybeSingle();
    if (testErr) throw testErr;
    if (!test) throw new Error('Test not found.');
    if (student.class_id !== test.class_id) {
      res.status(400).json({ error: 'Student does not belong to the test class.' });
      return;
    }

    const { error } = await db.from('results').upsert(
      {
        student_id: studentId,
        test_id: testId,
        marks,
        percentage,
      },
      { onConflict: 'student_id,test_id' }
    );
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'upsert result failed' });
  }
});

app.patch('/api/scores/:id', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const payload = {};
    if (req.body?.newScore != null) payload.marks = Number(req.body.newScore);
    if (req.body?.percentage != null) payload.percentage = Number(req.body.percentage);
    if (!Object.keys(payload).length) {
      res.status(400).json({ error: 'newScore or percentage is required.' });
      return;
    }
    const { error } = await db.from('results').update(payload).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'update result failed' });
  }
});

app.get('/api/students/:studentId/results/by-test', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { studentId } = req.params;
    const { data, error } = await db
      .from('results')
      .select('marks, tests(name, subjects(name))')
      .eq('student_id', studentId);
    if (error) throw error;
    const out = (data || []).map((r) => ({
      testName: r.tests?.name || '',
      subjectName: r.tests?.subjects?.name || '',
      marks: Number(r.marks),
    }));
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err?.message || 'get results by test failed' });
  }
});

app.get('/api/students/:studentId/results/by-subject', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { studentId } = req.params;
    const { data, error } = await db
      .from('results')
      .select('marks, tests(name, subjects(name))')
      .eq('student_id', studentId);
    if (error) throw error;
    const grouped = {};
    for (const row of data || []) {
      const subject = row.tests?.subjects?.name || 'Unknown';
      if (!grouped[subject]) grouped[subject] = [];
      grouped[subject].push({
        testName: row.tests?.name || '',
        marks: Number(row.marks),
      });
    }
    res.json(
      Object.entries(grouped).map(([subject, tests]) => ({
        subject,
        tests,
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err?.message || 'get results by subject failed' });
  }
});

app.get('/api/students/:studentId/report-card', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const { studentId } = req.params;
    const { data, error } = await db
      .from('results')
      .select('marks, percentage, tests(name, subjects(name))')
      .eq('student_id', studentId);
    if (error) throw error;
    const bySubject = {};
    let totalMarks = 0;
    let percentageSum = 0;
    let percentageCount = 0;
    for (const row of data || []) {
      const subject = row.tests?.subjects?.name || 'Unknown';
      if (!bySubject[subject]) bySubject[subject] = { subject, totalMarks: 0, tests: [] };
      const marks = Number(row.marks) || 0;
      bySubject[subject].totalMarks += marks;
      bySubject[subject].tests.push({
        testName: row.tests?.name || '',
        marks,
        percentage: row.percentage != null ? Number(row.percentage) : null,
      });
      totalMarks += marks;
      if (row.percentage != null) {
        percentageSum += Number(row.percentage);
        percentageCount += 1;
      }
    }
    res.json({
      subjects: Object.values(bySubject),
      totals: {
        marks: totalMarks,
        percentage: percentageCount ? Number((percentageSum / percentageCount).toFixed(2)) : null,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'get report card failed' });
  }
});

app.post('/api/students/assign-teacher', async (req, res) => {
  res.status(410).json({ error: 'Deprecated in new schema.' });
});

app.post('/api/student-subject-assignments', async (req, res) => {
  res.status(410).json({ error: 'Deprecated in new schema.' });
});

app.post('/api/test-analyses', async (req, res) => {
  res.status(410).json({ error: 'Deprecated in new schema.' });
});

app.post('/api/students/find-by-roll', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { rollNo, classId } = req.body || {};
    const id = await repo.findStudentIdByRollNo(ctx.supabase, rollNo, classId);
    res.json({ studentId: id });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'findStudentIdByRollNo failed' });
  }
});

app.post('/api/answer-sheets', async (_req, res) => {
  res.status(410).json({ error: 'Deprecated in new schema.' });
});

app.get('/api/answer-sheets/by-test/:testId', async (_req, res) => {
  res.status(410).json({ error: 'Deprecated in new schema.' });
});

app.post('/api/evaluations', async (_req, res) => {
  res.status(410).json({ error: 'Deprecated in new schema. Use /api/scores.' });
});

app.patch('/api/answer-sheets/:id/status', async (_req, res) => {
  res.status(410).json({ error: 'Deprecated in new schema.' });
});

/** Multipart: file + testId, studentId, rollNo, testJson (optional). */
app.post('/api/evaluate/upload-and-evaluate', upload.single('file'), async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const db = createServiceSupabase();
    const {
      data: { user },
      error: userErr,
    } = await ctx.supabase.auth.getUser();
    if (userErr || !user) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return;
    }
    let { data: teacher, error: teacherLookupErr } = await db
      .from('teachers')
      .select('id, subject_id, user_id, email')
      .eq('user_id', user.id)
      .maybeSingle();
    if (teacherLookupErr) throw teacherLookupErr;
    if (!teacher && user.email) {
      const { data: teacherByEmail, error: teacherByEmailErr } = await db
        .from('teachers')
        .select('id, subject_id, user_id, email')
        .eq('email', normalizeEmail(user.email))
        .maybeSingle();
      if (teacherByEmailErr) throw teacherByEmailErr;
      teacher = teacherByEmail || null;
    }
    if (!teacher) {
      res.status(403).json({ error: 'Only teachers can upload and evaluate.' });
      return;
    }
    const { testId, studentId } = req.body || {};
    if (!testId || !studentId) {
      res.status(400).json({ error: 'testId and studentId are required.' });
      return;
    }

    const { data: test, error: testErr } = await db
      .from('tests')
      .select('id, name, class_id, subject_id')
      .eq('id', testId)
      .maybeSingle();
    if (testErr) throw testErr;
    if (!test) throw new Error('Test not found.');
    if (teacher.subject_id !== test.subject_id) {
      res.status(403).json({ error: 'Teacher can only evaluate tests for their subject.' });
      return;
    }

    const { data: student, error: studentErr } = await db
      .from('students')
      .select('id, name, class_id')
      .eq('id', studentId)
      .maybeSingle();
    if (studentErr) throw studentErr;
    if (!student) throw new Error('Student not found.');
    if (student.class_id !== test.class_id) {
      res.status(400).json({ error: 'Student does not belong to the selected test class.' });
      return;
    }

    let parsedTest = null;
    try {
      parsedTest = req.body?.testJson ? JSON.parse(req.body.testJson) : null;
    } catch {
      parsedTest = null;
    }
    const topics = Array.isArray(parsedTest?.topics) ? parsedTest.topics : [];
    const totalMarksRaw = Number(parsedTest?.totalMarks);
    const totalMarks = Number.isFinite(totalMarksRaw) && totalMarksRaw > 0 ? totalMarksRaw : 100;

    const evaluation = buildEvaluation(topics, totalMarks);
    const marks = Number(evaluation.marks) || 0;
    const percentage = Number(((marks / totalMarks) * 100).toFixed(2));

    const { error: upsertErr } = await db.from('results').upsert(
      {
        student_id: student.id,
        test_id: test.id,
        marks,
        percentage,
      },
      { onConflict: 'student_id,test_id' }
    );
    if (upsertErr) throw upsertErr;

    res.json({
      marks,
      grade: evaluation.grade,
      feedback: evaluation.feedback,
      perQuestionScores: evaluation.perQuestionScores,
      topicRCA: evaluation.topicRCA,
      improvementPlan: evaluation.improvementPlan,
      topicScores: evaluation.topicScores,
      testId: test.id,
      testName: test.name,
      studentId: student.id,
      studentName: student.name,
      fileName: req.file?.originalname || null,
    });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'upload and evaluate failed' });
  }
});

/** Re-evaluate an existing answer sheet row (optional utility). */
app.post('/api/evaluate/answer-sheet/:answerSheetId', async (_req, res) => {
  res.status(410).json({ error: 'Deprecated in new schema.' });
});

async function start() {
  await logSupabaseStartupCheck();
  const server = app.listen(PORT, () => {
    console.log(`API server listening on http://127.0.0.1:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('[api] server error:', err?.message || err);
  });
}

start().catch((err) => {
  console.error('[api] startup failed:', err?.stack || err?.message || err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[api] uncaughtException:', err?.stack || err?.message || err);
});
