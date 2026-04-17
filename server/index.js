/**
 * Thin API layer: Express forwards the user's Supabase JWT to PostgREST so RLS is unchanged.
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as repo from '../src/lib/schoolRepository.js';
import { resolveCurrentUser } from '../src/lib/resolveCurrentUser.js';
import {
  createAndEvaluate,
  evaluateAnswerSheet,
} from '../src/lib/evaluationService.js';
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

async function upsertPortalIdentity(service, { userId, email, fullName, role, schoolId }) {
  const profilePayload = {
    user_id: userId,
    email: normalizeEmail(email),
    full_name: fullName || null,
    role,
    school_id: schoolId ?? null,
  };
  const { error: profileErr } = await service.from('profiles').upsert(profilePayload, { onConflict: 'user_id' });
  if (profileErr) throw profileErr;

  const { error: roleErr } = await service
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' });
  if (roleErr) throw roleErr;
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
  const resolved = await resolveCurrentUser(supabase, user);
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

    const resolved = await resolveCurrentUser(userSupabase, user);
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
    const resolved = await resolveCurrentUser(supabase, user);
    res.json(resolved);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'resolve failed' });
  }
});

/** Schools list for registration — uses anon key; RLS allows public read. */
app.get('/api/schools', async (_req, res) => {
  try {
    const supabase = createAnonSupabase();
    const { data, error } = await supabase.from('schools').select('id,name,created_at').order('created_at');
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
    const payload = req.body || {};
    const row = await repo.insertSchool(ctx.supabase, payload);
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
          schoolId: row.id,
        });
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
    await repo.deleteSchool(ctx.supabase, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'failed to delete school' });
  }
});

app.post('/api/school-data', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const schoolId = req.body?.schoolId ?? null;
    const data = await repo.loadSchoolData(ctx.supabase, { schoolId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'loadSchoolData failed' });
  }
});

app.post('/api/teachers', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
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
        schoolId: payload.schoolId ?? payload.school_id ?? null,
      });
      id = await repo.insertTeacher(ctx.supabase, { ...payload, email, userId });
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
        schoolId,
      });
      const classIdMap = await repo.fetchClassIdMap(ctx.supabase, schoolId);
      id = await repo.insertStudent(ctx.supabase, { ...row, email, userId }, classIdMap);
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
    const row = req.body?.row || req.body;
    const schoolId = row.schoolId || row.school_id;
    if (!schoolId) {
      res.status(400).json({ error: 'schoolId is required.' });
      return;
    }
    const classIdMap = await repo.fetchClassIdMap(ctx.supabase, schoolId);
    await repo.updateStudent(ctx.supabase, req.params.id, row, classIdMap);
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
    const { className, schoolId } = req.body || {};
    await repo.insertClass(ctx.supabase, { schoolId, className });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertClass failed' });
  }
});

app.get('/api/class-id-map', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const schoolId = req.query.schoolId;
    if (!schoolId) {
      res.status(400).json({ error: 'schoolId query param is required.' });
      return;
    }
    const map = await repo.fetchClassIdMap(ctx.supabase, schoolId);
    res.json(Object.fromEntries(map));
  } catch (err) {
    res.status(400).json({ error: err?.message || 'fetchClassIdMap failed' });
  }
});

app.post('/api/teacher-class-assignments', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { teacherId, className, subject, schoolId } = req.body || {};
    if (!schoolId) {
      res.status(400).json({ error: 'schoolId is required.' });
      return;
    }
    const classIdMap = await repo.fetchClassIdMap(ctx.supabase, schoolId);
    await repo.insertTeacherClassAssignment(ctx.supabase, teacherId, className, subject, classIdMap);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertTeacherClassAssignment failed' });
  }
});

app.patch('/api/teacher-class-assignments', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { oldTeacherId, newTeacherId, className, subject, schoolId } = req.body || {};
    if (!schoolId) {
      res.status(400).json({ error: 'schoolId is required.' });
      return;
    }
    const classIdMap = await repo.fetchClassIdMap(ctx.supabase, schoolId);
    await repo.updateTeacherClassAssignmentTeacher(
      ctx.supabase,
      oldTeacherId,
      newTeacherId,
      className,
      subject,
      classIdMap
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'updateTeacherClassAssignmentTeacher failed' });
  }
});

app.post('/api/tests', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { testInput, createdByTeacherId } = req.body || {};
    const id = await repo.createTestRecord(ctx.supabase, testInput, {
      createdByTeacherId: createdByTeacherId ?? null,
    });
    res.json({ id });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'createTestRecord failed' });
  }
});

app.delete('/api/tests/:id', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    await repo.deleteTest(ctx.supabase, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'deleteTest failed' });
  }
});

app.post('/api/scores', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { studentId, testId, scoreData } = req.body || {};
    await repo.insertScore(ctx.supabase, studentId, testId, scoreData);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertScore failed' });
  }
});

app.patch('/api/scores/:id', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    await repo.updateScoreValue(ctx.supabase, req.params.id, req.body?.newScore);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'updateScoreValue failed' });
  }
});

app.post('/api/students/assign-teacher', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { studentIds, teacherId } = req.body || {};
    await repo.assignStudentsToTeacher(ctx.supabase, studentIds, teacherId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'assignStudentsToTeacher failed' });
  }
});

app.post('/api/student-subject-assignments', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { studentId, teacherId, subject } = req.body || {};
    await repo.upsertStudentSubjectTeacherAssignment(ctx.supabase, { studentId, teacherId, subject });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'upsertStudentSubjectTeacherAssignment failed' });
  }
});

app.post('/api/test-analyses', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    await repo.insertTestAnalysisRow(ctx.supabase, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertTestAnalysisRow failed' });
  }
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

app.post('/api/answer-sheets', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const id = await repo.insertAnswerSheet(ctx.supabase, req.body || {});
    res.json({ id });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'insertAnswerSheet failed' });
  }
});

app.get('/api/answer-sheets/by-test/:testId', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const rows = await repo.fetchAnswerSheetsByTest(ctx.supabase, req.params.testId);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err?.message || 'fetchAnswerSheetsByTest failed' });
  }
});

app.post('/api/evaluations', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const { studentId, testId, evalData } = req.body || {};
    await repo.saveEvaluation(ctx.supabase, studentId, testId, evalData);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'saveEvaluation failed' });
  }
});

app.patch('/api/answer-sheets/:id/status', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    await repo.updateAnswerSheetStatus(ctx.supabase, req.params.id, req.body?.status);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'updateAnswerSheetStatus failed' });
  }
});

/** Multipart: file + testId, studentId, rollNo, testJson (optional). */
app.post('/api/evaluate/upload-and-evaluate', upload.single('file'), async (req, res) => {
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
    const resolved = await resolveCurrentUser(supabase, user);
    if (resolved.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can upload answer sheets.' });
      return;
    }

    const file = req.file;
    const testId = req.body?.testId;
    const studentId = req.body?.studentId;
    const rollNo = req.body?.rollNo || '';
    if (!file || !testId || !studentId) {
      res.status(400).json({ error: 'Missing file, testId, or studentId.' });
      return;
    }

    let test = null;
    if (req.body?.testJson) {
      try {
        test = JSON.parse(req.body.testJson);
      } catch {
        test = null;
      }
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `sheets/${resolved.id}/roll${rollNo}-${Date.now()}-${safeName}`;

    let finalPath = '';
    const { error: uploadErr } = await supabase.storage.from('answer-sheets').upload(storagePath, file.buffer, {
      contentType: file.mimetype || undefined,
      upsert: true,
    });
    if (uploadErr) {
      console.warn('[api] Storage upload skipped:', uploadErr.message);
    } else {
      finalPath = storagePath;
    }

    const result = await createAndEvaluate(supabase, {
      testId,
      studentId,
      teacherId: resolved.id,
      storagePath: finalPath,
      test,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err?.message || 'upload-and-evaluate failed' });
  }
});

/** Re-evaluate an existing answer sheet row (optional utility). */
app.post('/api/evaluate/answer-sheet/:answerSheetId', async (req, res) => {
  try {
    const ctx = await requireUserSupabase(req, res);
    if (!ctx) return;
    const evaluation = await evaluateAnswerSheet(ctx.supabase, req.params.answerSheetId, req.body || {});
    res.json(evaluation);
  } catch (err) {
    res.status(400).json({ error: err?.message || 'evaluateAnswerSheet failed' });
  }
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
