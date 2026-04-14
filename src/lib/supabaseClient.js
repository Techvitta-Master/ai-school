import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase client for browser usage.
 * Requires:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Default Web Locks (navigator.locks) can deadlock or throw NavigatorLockAcquireTimeoutError
          // in dev (Strict Mode), multi-tab, or after lock steal — blocking getSession() and leaving the app on "Loading...".
          lock: async (_name, _acquireTimeout, fn) => await fn(),
        },
      })
    : null;

