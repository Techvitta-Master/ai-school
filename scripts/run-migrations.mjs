/**
 * Applies all supabase/sql/*.sql files in filename order using a direct Postgres URL.
 *
 * Requires DATABASE_URL (or DIRECT_URL) — use the connection string from
 * Supabase Dashboard → Project Settings → Database (URI, with password).
 * Never commit that string; keep it only in .env locally or in CI secrets.
 *
 * Usage:
 *   npm run migrate
 *   npm run migrate:dry
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sqlDir = path.join(root, 'supabase', 'sql');

const dryRun = process.argv.includes('--dry-run');

function redactConnectionString(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(invalid URL)';
  }
}

async function main() {
  if (!fs.existsSync(sqlDir)) {
    console.error('Not found:', sqlDir);
    process.exit(1);
  }

  const includeReset = process.env.MIGRATE_INCLUDE_RESET === '1';

  const files = fs
    .readdirSync(sqlDir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      if (includeReset) return true;
      if (/reset/i.test(f)) {
        console.warn(
          `[migrate] Skipping ${f} (destructive). Set MIGRATE_INCLUDE_RESET=1 to include.`
        );
        return false;
      }
      return true;
    })
    .sort();

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (dryRun) {
    console.log(`[migrate] ${files.length} file(s) would run (sorted):`);
    for (const f of files) {
      console.log(`  - ${f}`);
    }
    console.log('[migrate] Dry run — no queries executed.');
    if (!connectionString) {
      console.log('[migrate] Tip: set DATABASE_URL in .env for a real run.');
    } else {
      console.log(`[migrate] Target (redacted): ${redactConnectionString(connectionString)}`);
    }
    return;
  }

  if (!connectionString) {
    console.error(
      'Missing DATABASE_URL or DIRECT_URL. Add your Postgres URI from Supabase → Settings → Database.'
    );
    process.exit(1);
  }

  console.log(`[migrate] Database (redacted): ${redactConnectionString(connectionString)}`);
  console.log(`[migrate] ${files.length} file(s) to apply:`);
  for (const f of files) {
    console.log(`  - ${f}`);
  }

  console.warn(
    '[migrate] Applying every file in order. Remove or rename destructive scripts (e.g. *_reset_*) from supabase/sql if you must not run them.'
  );

  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log('[migrate] Postgres connection OK.');

  try {
    for (const name of files) {
      const full = path.join(sqlDir, name);
      const sql = fs.readFileSync(full, 'utf8');
      console.log(`[migrate] Applying ${name} …`);
      await client.query(sql);
      console.log(`[migrate] Done ${name}`);
    }
  } finally {
    await client.end();
  }

  console.log('[migrate] All files applied.');
}

main().catch((err) => {
  console.error('[migrate] Failed:', err?.message || err);
  process.exit(1);
});
