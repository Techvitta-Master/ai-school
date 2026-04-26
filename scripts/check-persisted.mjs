import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RESULT_ID = process.argv[2] || '167e30c4-bb49-4d2b-a23d-06e9b234f129';

async function show(label, q) {
  const { data, error } = await q;
  if (error) {
    console.log(`${label}: ERROR ${error.message}`);
    return;
  }
  console.log(`${label}: ${Array.isArray(data) ? data.length + ' rows' : data ? '1 row' : 'null'}`);
  if (Array.isArray(data) && data.length) console.log('  sample:', JSON.stringify(data[0]).slice(0, 250));
  else if (data && !Array.isArray(data)) console.log('  row:', JSON.stringify(data).slice(0, 250));
}

console.log(`Inspecting result_id = ${RESULT_ID}\n`);

await show('results',
  sb.from('results').select('id, student_id, test_id, marks, percentage, created_at').eq('id', RESULT_ID).maybeSingle());

await show('grading_jobs',
  sb.from('grading_jobs').select('id, status, model_versions, degraded_mode, submission_id, result_id, created_at').eq('result_id', RESULT_ID));

// Get all grading_jobs (ordered newest first) and inspect each linked submission.
const { data: allJobs } = await sb
  .from('grading_jobs')
  .select('id, submission_id, model_versions, created_at, finished_at, degraded_mode')
  .eq('result_id', RESULT_ID)
  .order('created_at', { ascending: false });
console.log(`\nall grading_jobs for this result (newest first):`);
for (const j of allJobs || []) {
  console.log(`  job=${j.id.slice(0,8)} sub=${j.submission_id?.slice(0,8)} models=${JSON.stringify(j.model_versions)} created=${j.created_at}`);
}

if (allJobs?.[0]?.submission_id) {
  await show('latest answer_submission',
    sb.from('answer_submissions').select('id, school_id, class_id, test_id, student_id, status, metadata, question_paper_path, answer_key_path, student_answer_path, submitted_at').eq('id', allJobs[0].submission_id).maybeSingle());
}

await show('question_scores',
  sb.from('question_scores').select('id, question_no, score, max_score, needs_review, semantic_similarity, llm_score').eq('result_id', RESULT_ID).order('question_no'));

await show('question_feedback (via question_scores)', (async () => {
  const { data: scores } = await sb.from('question_scores').select('id').eq('result_id', RESULT_ID);
  if (!scores?.length) return { data: [], error: null };
  return sb.from('question_feedback').select('question_score_id, key_concepts_present, missed_concepts, exemplar_answer').in('question_score_id', scores.map(s => s.id));
})());

await show('student_improvement_plans',
  sb.from('student_improvement_plans').select('id, plan_text, weak_topics, tasks, topic_breakdown, model_version, generated_at').eq('result_id', RESULT_ID).maybeSingle());

await show('grading_audit',
  sb.from('grading_audit').select('id, action, after_score, reason, created_at').eq('result_id', RESULT_ID));
