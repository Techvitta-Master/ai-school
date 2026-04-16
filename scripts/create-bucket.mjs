/**
 * create-bucket.mjs
 * Creates the 'answer-sheets' storage bucket in the Supabase project.
 * Usage: node scripts/create-bucket.mjs
 * Requires: SUPABASE_ACCESS_TOKEN env var
 */

const PROJECT_REF = 'jyuajjenppgfafgmrtew';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN first.');
  process.exit(1);
}

async function run() {
  console.log('Creating answer-sheets bucket…');

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/storage/buckets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      id: 'answer-sheets',
      name: 'answer-sheets',
      public: false,
      file_size_limit: 10485760,
      allowed_mime_types: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = body?.message || body?.error || JSON.stringify(body);
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
      console.log('Bucket already exists — skipping creation.');
    } else {
      console.error('Failed to create bucket:', msg);
      process.exit(1);
    }
  } else {
    console.log('Bucket created:', body.name || 'answer-sheets');
  }

  // Verify via SQL query
  const verify = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      query: "select id, name, public, file_size_limit from storage.buckets where id = 'answer-sheets';",
    }),
  });

  const rows = await verify.json().catch(() => []);
  if (Array.isArray(rows) && rows[0]) {
    const b = rows[0];
    console.log('\nBucket verified in DB:');
    console.log(`  id              : ${b.id}`);
    console.log(`  public          : ${b.public}`);
    console.log(`  file_size_limit : ${b.file_size_limit} bytes (${Math.round(b.file_size_limit / 1024 / 1024)} MB)`);
    console.log('\nAll set! File uploads will work end-to-end.\n');
  }
}

run().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
