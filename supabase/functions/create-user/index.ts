import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeEmail(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await userClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid session.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerRow } = await service.from('users').select('role').eq('id', caller.id).maybeSingle();
    const role = String(callerRow?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'school') {
      return new Response(JSON.stringify({ error: 'Forbidden.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const kind = String(body.role || '').toLowerCase();
    const defaultPassword =
      Deno.env.get('PORTAL_DEFAULT_PASSWORD') || Deno.env.get('VITE_DEMO_PASSWORD') || '123456';
    const password = String(body.password || defaultPassword);

    if (kind === 'teacher') {
      const email = normalizeEmail(body.email);
      const name = String(body.name || '').trim();
      const schoolId = String(body.schoolId || '');
      const subjectId = String(body.subjectId || '');
      if (!email || !name || !schoolId || !subjectId) {
        return new Response(JSON.stringify({ error: 'name, email, schoolId and subjectId are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (role === 'school') {
        const { data: schoolRow } = await service.from('schools').select('id').eq('created_by', caller.id).maybeSingle();
        if (!schoolRow || schoolRow.id !== schoolId) {
          return new Response(JSON.stringify({ error: 'School scope mismatch.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const fullName = String(body.fullName || name);
      const createRes = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'teacher', full_name: fullName },
      });

      let userId: string | null = null;
      let created = false;

      if (!createRes.error && createRes.data?.user) {
        userId = createRes.data.user.id;
        created = true;
      } else if (createRes.error) {
        return new Response(JSON.stringify({ error: createRes.error.message || 'Auth create failed.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Failed to provision auth user.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const { error: uErr } = await service.from('users').upsert(
          { id: userId, email, role: 'teacher' },
          { onConflict: 'id' }
        );
        if (uErr) throw uErr;

        const { data: ins, error: tErr } = await service
          .from('teachers')
          .insert({
            user_id: userId,
            school_id: schoolId,
            subject_id: subjectId,
            name,
            email,
          })
          .select('id')
          .single();
        if (tErr) throw tErr;

        return new Response(JSON.stringify({ id: ins.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        if (created) {
          await service.auth.admin.deleteUser(userId);
        }
        throw e;
      }
    }

    if (kind === 'student') {
      const email = normalizeEmail(body.email);
      const name = String(body.name || '').trim();
      const schoolId = String(body.schoolId || '');
      const classId = String(body.classId || '');
      const rollNo = body.rollNo != null ? String(body.rollNo) : null;
      if (!email || !name || !schoolId || !classId) {
        return new Response(JSON.stringify({ error: 'email, name, schoolId and classId are required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (role === 'school') {
        const { data: schoolRow } = await service.from('schools').select('id').eq('created_by', caller.id).maybeSingle();
        if (!schoolRow || schoolRow.id !== schoolId) {
          return new Response(JSON.stringify({ error: 'School scope mismatch.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const fullName = String(body.fullName || name);
      const createRes = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'student', full_name: fullName },
      });

      let userId: string | null = null;
      let created = false;

      if (!createRes.error && createRes.data?.user) {
        userId = createRes.data.user.id;
        created = true;
      } else if (createRes.error) {
        return new Response(JSON.stringify({ error: createRes.error.message || 'Auth create failed.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Failed to provision auth user.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const { error: uErr } = await service.from('users').upsert(
          { id: userId, email, role: 'student' },
          { onConflict: 'id' }
        );
        if (uErr) throw uErr;

        const { data: ins, error: sErr } = await service
          .from('students')
          .insert({
            user_id: userId,
            school_id: schoolId,
            class_id: classId,
            name,
            email,
            roll_no: rollNo,
          })
          .select('id')
          .single();
        if (sErr) throw sErr;

        return new Response(JSON.stringify({ id: ins.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        if (created) {
          await service.auth.admin.deleteUser(userId);
        }
        throw e;
      }
    }

    return new Response(JSON.stringify({ error: 'Unsupported role.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
