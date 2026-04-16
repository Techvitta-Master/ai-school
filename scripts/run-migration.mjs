/**
 * run-migration.mjs
 * Runs a SQL file against the remote Supabase project using the Management API.
 *
 * Usage:
 *   node scripts/run-migration.mjs <path-to-sql-file>
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN env var  — get yours at
 *   https://supabase.com/dashboard/account/tokens
 *
 * Example:
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_xxx..."
 *   node scripts/run-migration.mjs supabase/sql/015_answer_sheets.sql
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jyuajjenppgfafgmrtew.supabase.co';
const PROJECT_REF  = SUPABASE_URL.replace('https://', '').split('.')[0];
const SQL_FILE     = process.argv[2];

if (!SQL_FILE) {
  console.error('\nUsage: node scripts/run-migration.mjs <path-to-sql-file>\n');
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), SQL_FILE);
let sql;
try {
  sql = readFileSync(sqlPath, 'utf-8');
} catch {
  console.error(`\nCannot read file: ${sqlPath}\n`);
  process.exit(1);
}

// ── Token ───────────────────────────────────────────────────────────────────
async function getToken() {
  let token = process.env.SUPABASE_ACCESS_TOKEN || '';
  if (token) return token.trim();

  // Prompt interactively
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question('\nPaste your Supabase Personal Access Token (sbp_…): ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Run SQL ─────────────────────────────────────────────────────────────────
async function main() {
  const token = await getToken();
  if (!token) {
    console.error('\nNo token provided. Get one at: https://supabase.com/dashboard/account/tokens\n');
    process.exit(1);
  }

  console.log(`\nProject ref : ${PROJECT_REF}`);
  console.log(`SQL file    : ${sqlPath}`);
  console.log('Running migration…\n');

  const endpoint = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  const res = await fetch(endpoint, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Migration FAILED');
    console.error(`Status : ${res.status}`);
    console.error('Response:', JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log('Migration completed successfully!\n');
  if (Array.isArray(body) && body.length) {
    console.table(body);
  } else {
    console.log('Result:', JSON.stringify(body, null, 2));
  }

  // Verify the new columns and table exist
  console.log('\nVerifying schema changes…');
  const verifyRes = await fetch(endpoint, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `
        select
          (select count(*) from information_schema.tables
           where table_schema = 'public' and table_name = 'answer_sheets')::int as answer_sheets_table,
          (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'scores'
             and column_name in ('feedback','grade'))::int as scores_new_columns;
      `,
    }),
  });
  const verify = await verifyRes.json().catch(() => []);
  if (Array.isArray(verify) && verify[0]) {
    const { answer_sheets_table, scores_new_columns } = verify[0];
    console.log(`  answer_sheets table : ${answer_sheets_table === 1 ? '✓ exists' : '✗ MISSING'}`);
    console.log(`  scores.feedback     : ${scores_new_columns >= 1 ? '✓ exists' : '✗ MISSING'}`);
    console.log(`  scores.grade        : ${scores_new_columns >= 2 ? '✓ exists' : '✗ MISSING'}\n`);
  }
}

main().catch(err => {
  console.error('\nUnexpected error:', err.message || err);
  process.exit(1);
});
