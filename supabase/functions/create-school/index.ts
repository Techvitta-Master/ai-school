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
    if (String(callerRow?.role || '').toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as { name?: string; schoolAdminEmail?: string; schoolAdminName?: string };
    const name = String(body.name || '').trim();
    const schoolAdminEmail = normalizeEmail(body.schoolAdminEmail);
    const schoolAdminName = String(body.schoolAdminName || `${name} Admin`).trim();

    if (!name) {
      return new Response(JSON.stringify({ error: 'School name is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const defaultPassword =
      Deno.env.get('PORTAL_DEFAULT_PASSWORD') || Deno.env.get('VITE_DEMO_PASSWORD') || '123456';

    const { data: school, error: sErr } = await service.from('schools').insert({ name }).select('id, name').single();
    if (sErr) throw sErr;

    if (!schoolAdminEmail) {
      return new Response(JSON.stringify({ school }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let userId: string | null = null;
    let created = false;
    try {
      const createRes = await service.auth.admin.createUser({
        email: schoolAdminEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { role: 'school', full_name: schoolAdminName },
      });

      if (!createRes.error && createRes.data?.user) {
        userId = createRes.data.user.id;
        created = true;
      } else if (createRes.error) {
        await service.from('schools').delete().eq('id', school.id);
        return new Response(JSON.stringify({ error: createRes.error.message || 'Auth create failed.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!userId) {
        await service.from('schools').delete().eq('id', school.id);
        return new Response(JSON.stringify({ error: 'Failed to provision school admin.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: uErr } = await service.from('users').upsert(
        { id: userId, email: schoolAdminEmail, role: 'school' },
        { onConflict: 'id' }
      );
      if (uErr) throw uErr;

      const { error: ownErr } = await service.from('schools').update({ created_by: userId }).eq('id', school.id);
      if (ownErr) throw ownErr;

      return new Response(JSON.stringify({ school: { ...school, created_by: userId } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      if (created && userId) {
        await service.auth.admin.deleteUser(userId);
      }
      await service.from('schools').delete().eq('id', school.id);
      throw e;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
