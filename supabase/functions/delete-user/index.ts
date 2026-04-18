import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const body = (await req.json()) as { kind?: string; id?: string };
    const kind = String(body.kind || '').toLowerCase();
    const id = String(body.id || '').trim();
    if (!kind || !id) {
      return new Response(JSON.stringify({ error: 'kind and id are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (kind === 'teacher') {
      const { data: row, error: rErr } = await service
        .from('teachers')
        .select('id, user_id, school_id')
        .eq('id', id)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!row) {
        return new Response(JSON.stringify({ error: 'Teacher not found.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (role === 'school') {
        const { data: schoolRow } = await service.from('schools').select('id').eq('created_by', caller.id).maybeSingle();
        if (!schoolRow || schoolRow.id !== row.school_id) {
          return new Response(JSON.stringify({ error: 'School scope mismatch.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const { data: tests } = await service.from('tests').select('id').eq('created_by', id);
      const testIds = (tests || []).map((t) => t.id);
      for (const tid of testIds) {
        await service.from('results').delete().eq('test_id', tid);
      }
      await service.from('tests').delete().eq('created_by', id);
      await service.from('teacher_classes').delete().eq('teacher_id', id);
      await service.from('teachers').delete().eq('id', id);

      const uid = row.user_id;
      await service.auth.admin.deleteUser(uid);
      await service.from('users').delete().eq('id', uid);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (kind === 'student') {
      const { data: row, error: rErr } = await service
        .from('students')
        .select('id, user_id, school_id')
        .eq('id', id)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!row) {
        return new Response(JSON.stringify({ error: 'Student not found.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (role === 'school') {
        const { data: schoolRow } = await service.from('schools').select('id').eq('created_by', caller.id).maybeSingle();
        if (!schoolRow || schoolRow.id !== row.school_id) {
          return new Response(JSON.stringify({ error: 'School scope mismatch.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      await service.from('students').delete().eq('id', id);
      const uid = row.user_id;
      await service.auth.admin.deleteUser(uid);
      await service.from('users').delete().eq('id', uid);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported kind.' }), {
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
