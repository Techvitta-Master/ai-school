/**
 * test-evaluation.mjs
 * Smoke-test the semantic AI evaluation pipeline end-to-end.
 *
 * Usage:
 *   node scripts/test-evaluation.mjs <scenario>
 *
 * Scenarios:
 *   strong       - paraphrased correct answer, expects high score + low needs_review
 *   offtopic     - irrelevant answer, expects low score
 *   plagiarism   - student copied the question text, expects low score + needs_review
 *   multilingual - Hindi answer to English key, expects similar score to English
 *
 * Required env (read from .env or shell):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * The script:
 *   1. picks the first {school, class, student, test} it can find
 *   2. uploads three text files to the answer-sheets bucket
 *   3. creates an answer_submission + grading_job
 *   4. invokes the edge function with sync=true
 *   5. reads back question_scores + question_feedback + improvement plan
 *   6. prints a verdict
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotenv() {
  const path = resolve(__dirname, '../.env');
  try {
    const raw = readFileSync(path, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  } catch {
    /* no .env file - that's fine */
  }
}

loadDotenv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const SCENARIOS = {
  strong: {
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)
Q2. Explain Newton's second law with one real-world example. (5 marks)`,
    answerKey: `Q1. Photosynthesis is the process by which green plants use sunlight to convert carbon dioxide and water into glucose and oxygen. The balanced equation is: 6CO2 + 6H2O -> C6H12O6 + 6O2 (in presence of sunlight and chlorophyll).
Q2. Newton's second law states that the force on an object equals its mass times its acceleration (F = ma). Example: pushing a heavier shopping trolley needs more force to reach the same speed.`,
    studentAnswer: `Q1. Photosynthesis is when plants make food using sunlight. They take in carbon dioxide and water, and release oxygen and glucose. Equation: 6CO2 + 6H2O -> C6H12O6 + 6O2 with help of sunlight and chlorophyll.
Q2. Newton's second law: F = m * a. The force needed depends on mass times acceleration. Example: kicking a heavy football needs more force than a light one to make it move at the same speed.`,
    expect: { minPercentage: 70, maxNeedsReview: 1 },
  },
  offtopic: {
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)
Q2. Explain Newton's second law with one real-world example. (5 marks)`,
    answerKey: `Q1. Photosynthesis... 6CO2 + 6H2O -> C6H12O6 + 6O2.
Q2. F = ma.`,
    studentAnswer: `Q1. Volcanoes erupt when magma rises through the crust. There are shield volcanoes and stratovolcanoes.
Q2. Mount Everest is the tallest mountain in the world.`,
    expect: { maxPercentage: 25 },
  },
  plagiarism: {
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)`,
    answerKey: `Q1. Photosynthesis is the process by which green plants use sunlight to convert carbon dioxide and water into glucose and oxygen. 6CO2 + 6H2O -> C6H12O6 + 6O2.`,
    studentAnswer: `Q1. Define photosynthesis and write its balanced chemical equation.`,
    expect: { maxPercentage: 30, expectNeedsReview: true },
  },
  multilingual: {
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)`,
    answerKey: `Q1. Photosynthesis: green plants make glucose from CO2 and water using sunlight. 6CO2 + 6H2O -> C6H12O6 + 6O2.`,
    studentAnswer: `Q1. प्रकाश संश्लेषण वह प्रक्रिया है जिसमें हरे पौधे सूर्य के प्रकाश की उपस्थिति में कार्बन डाइऑक्साइड और पानी से ग्लूकोज और ऑक्सीजन बनाते हैं। समीकरण: 6CO2 + 6H2O -> C6H12O6 + 6O2.`,
    expect: { minPercentage: 60 },
  },
};

const scenarioName = process.argv[2] || 'strong';
const scenario = SCENARIOS[scenarioName];
if (!scenario) {
  console.error(`Unknown scenario "${scenarioName}". Choose one of: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}

const svc = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function pickFixtures() {
  const { data: schools } = await svc.from('schools').select('id, name').limit(1);
  if (!schools?.length) throw new Error('No schools seeded.');
  const schoolId = schools[0].id;
  const { data: classes } = await svc.from('classes').select('id').eq('school_id', schoolId).limit(1);
  if (!classes?.length) throw new Error('No classes for the first school.');
  const classId = classes[0].id;
  const { data: students } = await svc.from('students').select('id, name, roll_no').eq('class_id', classId).limit(1);
  if (!students?.length) throw new Error('No students in that class.');
  const student = students[0];
  const { data: tests } = await svc.from('tests').select('id, name').eq('class_id', classId).limit(1);
  if (!tests?.length) throw new Error('No tests for that class.');
  const { data: teachers } = await svc.from('teachers').select('id').eq('school_id', schoolId).limit(1);
  return {
    schoolId,
    classId,
    studentId: student.id,
    studentName: student.name,
    rollNo: student.roll_no,
    testId: tests[0].id,
    testName: tests[0].name,
    teacherId: teachers?.[0]?.id || null,
  };
}

async function uploadText(bucket, path, text) {
  const bytes = new TextEncoder().encode(text);
  const { error } = await svc.storage.from(bucket).upload(path, bytes, { upsert: true, contentType: 'text/plain' });
  if (error) throw error;
}

async function run() {
  const fixtures = await pickFixtures();
  console.log(`\n[scenario: ${scenarioName}] using student=${fixtures.studentName} (#${fixtures.rollNo}) test=${fixtures.testName}`);

  const bucket = 'answer-sheets';
  const baseDir = `ai-test/${scenarioName}/${randomUUID()}`;
  const qpPath = `${baseDir}/question.txt`;
  const keyPath = `${baseDir}/key.txt`;
  const studentPath = `${baseDir}/student.txt`;
  await uploadText(bucket, qpPath, scenario.questionPaper);
  await uploadText(bucket, keyPath, scenario.answerKey);
  await uploadText(bucket, studentPath, scenario.studentAnswer);

  const { data: submission, error: subErr } = await svc
    .from('answer_submissions')
    .insert({
      school_id: fixtures.schoolId,
      class_id: fixtures.classId,
      test_id: fixtures.testId,
      student_id: fixtures.studentId,
      uploaded_by_teacher_id: fixtures.teacherId,
      storage_bucket: bucket,
      question_paper_path: qpPath,
      answer_key_path: keyPath,
      student_answer_path: studentPath,
      mime_type: 'text/plain',
      status: 'queued',
      metadata: { scenario: scenarioName, source: 'test-evaluation.mjs' },
    })
    .select('id')
    .single();
  if (subErr) throw subErr;

  const { data: job, error: jobErr } = await svc
    .from('grading_jobs')
    .insert({
      submission_id: submission.id,
      school_id: fixtures.schoolId,
      status: 'queued',
      attempts: 0,
      idempotency_key: `test-${scenarioName}-${randomUUID()}`,
      model_config: { trigger: 'smoke-test' },
    })
    .select('id')
    .single();
  if (jobErr) throw jobErr;

  console.log(`[job: ${job.id}] invoking edge function (sync)...`);
  const t0 = Date.now();
  const { data, error } = await svc.functions.invoke('ai-evaluate-submission', {
    body: { jobId: job.id, sync: true },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[done in ${elapsed}s]`, data);

  const { data: scores } = await svc
    .from('question_scores')
    .select('id, question_no, score, max_score, needs_review, semantic_similarity, llm_score, confidence, evaluator_reasoning, topic, bloom_level, student_lang, model_lang, review_reasons')
    .eq('result_id', data.resultId)
    .order('question_no');
  const { data: feedback } = await svc
    .from('question_feedback')
    .select('question_score_id, missed_concepts, key_concepts_present, suggested_format, exemplar_answer')
    .in('question_score_id', (scores || []).map((s) => s.id));
  const { data: plan } = await svc
    .from('student_improvement_plans')
    .select('plan_text, weak_topics, topic_breakdown, tasks, generated_by, model_version')
    .eq('result_id', data.resultId)
    .maybeSingle();

  const fbById = Object.fromEntries((feedback || []).map((f) => [f.question_score_id, f]));
  const totalMax = (scores || []).reduce((a, q) => a + Number(q.max_score), 0) || 1;
  const totalScore = (scores || []).reduce((a, q) => a + Number(q.score), 0);
  const pct = Math.round((totalScore / totalMax) * 100);

  console.log('\n=== Per-question results ===');
  for (const q of scores || []) {
    const fb = fbById[q.id] || {};
    console.log(`\n${q.question_no}: ${q.score}/${q.max_score}  (LLM=${q.llm_score}, sim=${Number(q.semantic_similarity).toFixed(2)}, conf=${q.confidence})`);
    console.log(`  topic=${q.topic}  bloom=${q.bloom_level}  lang=${q.student_lang}/${q.model_lang}`);
    if (q.needs_review) console.log(`  ⚠ needs_review: ${(q.review_reasons || []).join('; ')}`);
    console.log(`  reasoning: ${q.evaluator_reasoning}`);
    if (fb.key_concepts_present?.length) console.log(`  ✅ got: ${fb.key_concepts_present.join(', ')}`);
    if (fb.missed_concepts?.length) console.log(`  ❌ missed: ${fb.missed_concepts.join(', ')}`);
    if (fb.suggested_format) console.log(`  📝 format: ${fb.suggested_format}`);
    if (fb.exemplar_answer) console.log(`  ✨ exemplar: ${fb.exemplar_answer.slice(0, 200)}${fb.exemplar_answer.length > 200 ? '…' : ''}`);
  }

  console.log('\n=== Improvement plan ===');
  if (plan) {
    console.log(`generated_by: ${plan.generated_by} (${plan.model_version})`);
    console.log(plan.plan_text);
    console.log(`weak_topics: ${(plan.weak_topics || []).join(', ')}`);
    if (Array.isArray(plan.topic_breakdown)) {
      for (const t of plan.topic_breakdown) {
        console.log(`  · ${t.topic} mastery=${Math.round((t.mastery || 0) * 100)}% missed=${(t.missed || []).join(', ')}`);
      }
    }
  }

  console.log(`\n=== TOTAL: ${totalScore}/${totalMax} (${pct}%) ===`);

  const failures = [];
  if (typeof scenario.expect.minPercentage === 'number' && pct < scenario.expect.minPercentage) {
    failures.push(`expected >= ${scenario.expect.minPercentage}% got ${pct}%`);
  }
  if (typeof scenario.expect.maxPercentage === 'number' && pct > scenario.expect.maxPercentage) {
    failures.push(`expected <= ${scenario.expect.maxPercentage}% got ${pct}%`);
  }
  if (typeof scenario.expect.maxNeedsReview === 'number') {
    const flagged = (scores || []).filter((s) => s.needs_review).length;
    if (flagged > scenario.expect.maxNeedsReview) failures.push(`expected <= ${scenario.expect.maxNeedsReview} needs_review got ${flagged}`);
  }
  if (scenario.expect.expectNeedsReview) {
    const flagged = (scores || []).some((s) => s.needs_review);
    if (!flagged) failures.push('expected at least one needs_review row');
  }

  if (failures.length) {
    console.error(`\n❌ Scenario failed: ${failures.join(' | ')}`);
    process.exit(1);
  }
  console.log(`\n✅ Scenario "${scenarioName}" passed expectations.`);
}

run().catch((err) => {
  console.error('\n[script error]', err);
  process.exit(1);
});
