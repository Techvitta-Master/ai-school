/**
 * The API does not hold a Postgres connection pool. It talks to Supabase over HTTPS
 * (PostgREST + Auth). This module checks that the project URL + anon key can reach PostgREST.
 */

function supabaseUrl() {
  const v = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  return typeof v === 'string' ? v.trim() : '';
}

function supabaseAnonKey() {
  const v = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * @returns {{ ok: true, host: string } | { ok: false, reason: 'missing_env' | 'http', status?: number }}
 */
export async function checkSupabaseReachable() {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) {
    return { ok: false, reason: 'missing_env' };
  }
  const base = url.replace(/\/$/, '');
  let host;
  try {
    host = new URL(base).host;
  } catch {
    return { ok: false, reason: 'http', status: 0 };
  }

  // OpenAPI at GET /rest/v1/ is no longer the supported anon probe (often 401). Use Auth health + a real PostgREST route.
  const authHealth = await fetch(`${base}/auth/v1/health`);
  if (!authHealth.ok) {
    return { ok: false, reason: 'http', status: authHealth.status };
  }

  // New publishable keys (sb_publishable_…) must NOT go in Authorization: Bearer — PostgREST tries to parse Bearer as a JWT and returns 401. Use apikey only (same as Supabase docs curl). Legacy eyJ… anon keys also work with apikey-only.
  const rest = await fetch(`${base}/rest/v1/profiles?select=id&limit=1`, {
    headers: {
      apikey: key,
    },
  });

  if (rest.status === 401) {
    return { ok: false, reason: 'http', status: 401 };
  }
  if (rest.status >= 500) {
    return { ok: false, reason: 'http', status: rest.status };
  }

  // 200 / 206, 404 (relation missing), 403 (RLS) — anon JWT is accepted by PostgREST.
  return { ok: true, host };
}

/** Call once at process startup. Never logs secrets. */
export async function logSupabaseStartupCheck() {
  const result = await checkSupabaseReachable();
  if (result.ok) {
    console.log(
      `[api] Supabase OK — PostgREST reachable at ${result.host} (HTTP API; no direct Postgres socket in this server).`
    );
    return;
  }
  if (result.reason === 'missing_env') {
    console.error(
      '[api] Supabase not configured: set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_* in .env).'
    );
    process.exit(1);
  }
  const hint =
    result.status === 401
      ? ' If you use a publishable key (sb_publishable_…), it must not be sent as Bearer — ensure server code uses the apikey header only for probes. Otherwise verify the key matches this project.'
      : ' Verify SUPABASE_URL and network.';
  console.warn(`[api] Supabase check failed: HTTP ${result.status ?? '?'}.${hint} Server will still start.`);
}
