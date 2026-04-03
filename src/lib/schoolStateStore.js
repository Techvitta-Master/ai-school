import { supabase } from './supabaseClient';

// Minimal persistence model:
// - Table: `school_state`
// - Columns:
//   - `id` (text or uuid) - primary key
//   - `school_data` (jsonb) - entire app data payload
//
// Create it (example):
//   create table if not exists public.school_state (
//     id text primary key,
//     school_data jsonb not null,
//     updated_at timestamptz not null default now()
//   );
//
// Then add RLS policies to allow the appropriate roles to read/write.
const SCHOOL_STATE_ID = 'default';

export async function fetchSchoolData({ fallbackData }) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('school_state')
    .select('school_data')
    .eq('id', SCHOOL_STATE_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.school_data ?? fallbackData;
}

export async function persistSchoolData({ schoolData }) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const payload = {
    id: SCHOOL_STATE_ID,
    school_data: schoolData,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('school_state')
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;
}

