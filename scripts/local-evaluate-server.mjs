/**
 * local-evaluate-server.mjs
 * Standalone HTTP server that runs the new semantic evaluation pipeline.
 *
 * Usage:
 *   node scripts/local-evaluate-server.mjs
 *
 * Endpoints:
 *   POST /api/evaluate
 *     body: { questionPaper: string, answerKey: string, studentAnswer: string }
 *     -> { result, questions[], plan, degraded, embeddingsAvailable }
 *
 *   GET /api/health
 *     -> { ok: true, sarvam: boolean }
 *
 * The pipeline mirrors the deployed Supabase edge function. Sarvam keys read
 * from the server's environment (load via .env).
 */

import { createServer } from 'node:http';
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
  } catch { /* no .env */ }
}
loadDotenv();

const SARVAM_KEY  = (process.env.SARVAM_API_SUBSCRIPTION_KEY || '').trim();
const CHAT_URL    = (process.env.SARVAM_CHAT_URL  || 'https://api.sarvam.ai/v1/chat/completions').trim();
const CHAT_MODEL  = (process.env.SARVAM_CHAT_MODEL || 'sarvam-105b').trim();
const EMBED_URL   = (process.env.SARVAM_EMBEDDING_URL || 'https://api.sarvam.ai/v1/embeddings').trim();
const EMBED_MODEL = (process.env.SARVAM_EMBEDDING_MODEL || 'sarvam-embedding-v1').trim();
const PORT        = Number(process.env.LOCAL_EVAL_PORT || 8787);
const ALLOWED_ORIGINS = String(process.env.AI_EVAL_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (!SARVAM_KEY) {
  console.error('[fatal] Missing SARVAM_API_SUBSCRIPTION_KEY in env / .env');
  process.exit(1);
}

// ── Supabase persistence (optional) ─────────────────────────────────────────
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log(`[supabase] persistence enabled → ${SUPABASE_URL}`);
  } catch (e) {
    console.warn(`[supabase] failed to initialise client: ${e.message}`);
  }
} else {
  console.log('[supabase] persistence disabled (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to enable)');
}

async function persistEvaluation({ pipelineOut, ids }) {
  if (!supabaseAdmin) return { saved: false, reason: 'no_client' };
  const { studentId, testId, classId, schoolId, teacherId, fileNames } = ids || {};
  if (!studentId || !testId || !classId || !schoolId) {
    return { saved: false, reason: 'missing_ids' };
  }

  const stamp = new Date().toISOString();
  const fName = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const submissionPaths = {
    question_paper_path: fileNames?.questionPaper ? `local/${stamp}-qp-${fName(fileNames.questionPaper)}` : '',
    answer_key_path:     fileNames?.answerKey     ? `local/${stamp}-key-${fName(fileNames.answerKey)}`    : '',
    student_answer_path: `local/${stamp}-ans-${fName(fileNames?.studentAnswer || 'student.pdf')}`,
  };

  // 1) answer_submissions
  const { data: subRow, error: subErr } = await supabaseAdmin
    .from('answer_submissions')
    .insert({
      school_id: schoolId, class_id: classId, test_id: testId, student_id: studentId,
      uploaded_by_teacher_id: teacherId || null,
      storage_bucket: 'answer-sheets',
      ...submissionPaths,
      status: 'done',
      metadata: { source: 'local-evaluator', degraded: pipelineOut.degraded, warnings: pipelineOut.inputWarnings || [] },
    })
    .select('id')
    .single();
  if (subErr) throw new Error(`answer_submissions insert: ${subErr.message}`);

  // 2) results (upsert on (student_id, test_id))
  const { data: resRow, error: resErr } = await supabaseAdmin
    .from('results')
    .upsert({
      student_id: studentId,
      test_id: testId,
      marks: pipelineOut.result.marks,
      percentage: pipelineOut.result.percentage,
    }, { onConflict: 'student_id,test_id' })
    .select('id')
    .single();
  if (resErr) throw new Error(`results upsert: ${resErr.message}`);

  // 3) grading_jobs
  const { data: jobRow, error: jobErr } = await supabaseAdmin
    .from('grading_jobs')
    .insert({
      submission_id: subRow.id,
      school_id: schoolId,
      status: 'done',
      attempts: 1,
      idempotency_key: `local-${randomUUID()}`,
      model_config: { chat: CHAT_MODEL, embed: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2' },
      model_versions: { chat: CHAT_MODEL, embed: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2' },
      degraded_mode: !!pipelineOut.degraded,
      result_id: resRow.id,
      started_at: stamp,
      finished_at: new Date().toISOString(),
      created_by: null,
    })
    .select('id')
    .single();
  if (jobErr) throw new Error(`grading_jobs insert: ${jobErr.message}`);

  // 4) question_scores — clear existing rows for this result first to keep upsert simple
  await supabaseAdmin.from('question_scores').delete().eq('result_id', resRow.id);

  const qsRows = pipelineOut.questions.map((q) => ({
    result_id: resRow.id,
    submission_id: subRow.id,
    test_id: testId,
    student_id: studentId,
    question_no: q.question_no,
    max_score: q.max_score,
    score: q.score,
    original_ai_score: q.original_ai_score,
    confidence: q.confidence,
    extracted_answer: q.extracted_answer,
    evaluator_reasoning: q.evaluator_reasoning,
    strengths: q.strengths,
    weaknesses: q.weaknesses,
    rubric: q.rubric,
    needs_review: !!q.needs_review,
    review_reasons: q.review_reasons || [],
    alignment_confidence: q.alignment_confidence,
    question_text: q.question_text,
    model_answer: q.model_answer,
    student_answer_present: !!q.student_answer_present,
    topic: q.topic,
    subtopic: q.subtopic,
    bloom_level: q.bloom_level,
    semantic_similarity: q.semantic_similarity,
    llm_score: q.llm_score,
    student_lang: q.student_lang,
    model_lang: q.model_lang,
  }));
  const { data: qsInserted, error: qsErr } = await supabaseAdmin
    .from('question_scores')
    .insert(qsRows)
    .select('id, question_no');
  if (qsErr) throw new Error(`question_scores insert: ${qsErr.message}`);

  // Map question_no → new question_score id so feedback rows can FK correctly
  const idByNo = new Map(qsInserted.map((r) => [r.question_no, r.id]));
  const fbRows = pipelineOut.questions
    .map((q) => ({ q, id: idByNo.get(q.question_no) }))
    .filter(({ id, q }) => id && q.feedback)
    .map(({ id, q }) => ({
      question_score_id: id,
      key_concepts_present: q.feedback.key_concepts_present || [],
      missed_concepts: q.feedback.missed_concepts || [],
      factual_errors: q.feedback.factual_errors || [],
      structural_issues: q.feedback.structural_issues || [],
      improvement_areas: q.feedback.improvement_areas || [],
      suggested_format: q.feedback.suggested_format || null,
      exemplar_answer: q.feedback.exemplar_answer || null,
    }));
  if (fbRows.length) {
    const { error: fbErr } = await supabaseAdmin.from('question_feedback').insert(fbRows);
    if (fbErr) throw new Error(`question_feedback insert: ${fbErr.message}`);
  }

  // 5) grading_audit — one row per question recording the AI score event,
  //    so teachers (and downstream analytics) can see when each score was assigned.
  //    Clear prior rows for this result first, since we re-grade every run.
  await supabaseAdmin.from('grading_audit').delete().eq('result_id', resRow.id);
  const auditRows = qsInserted.map((qs) => {
    const q = pipelineOut.questions.find((x) => x.question_no === qs.question_no);
    return {
      question_score_id: qs.id,
      result_id: resRow.id,
      actor_id: null,
      actor_role: 'system',
      action: 'ai_score',
      before_score: null,
      after_score: q?.score ?? 0,
      reason: q?.evaluator_reasoning ? clampLen(q.evaluator_reasoning, 600) : null,
      metadata: {
        chat_model: CHAT_MODEL,
        confidence: q?.confidence,
        semantic_similarity: q?.semantic_similarity,
        needs_review: !!q?.needs_review,
        review_reasons: q?.review_reasons || [],
      },
    };
  });
  if (auditRows.length) {
    const { error: auditErr } = await supabaseAdmin.from('grading_audit').insert(auditRows);
    if (auditErr) throw new Error(`grading_audit insert: ${auditErr.message}`);
  }

  // 6) student_improvement_plans (upsert on (student_id, test_id, result_id))
  if (pipelineOut.plan) {
    const { error: planErr } = await supabaseAdmin
      .from('student_improvement_plans')
      .upsert({
        student_id: studentId,
        test_id: testId,
        result_id: resRow.id,
        submission_id: subRow.id,
        plan_text: pipelineOut.plan.plan_text || '',
        weak_topics: pipelineOut.plan.weak_topics || [],
        tasks: pipelineOut.plan.tasks || [],
        topic_breakdown: pipelineOut.plan.topic_breakdown || [],
        model_version: CHAT_MODEL,
        generated_by: 'llm',
      }, { onConflict: 'student_id,test_id,result_id' });
    if (planErr) throw new Error(`student_improvement_plans upsert: ${planErr.message}`);
  }

  return { saved: true, submissionId: subRow.id, jobId: jobRow.id, resultId: resRow.id };
}

// ── tiny utilities ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clampLen = (s, n) => String(s || '').slice(0, n);
const safeNumber = (v, fb) => (Number.isFinite(Number(v)) ? Number(v) : fb);
const safeStrArr = (v, max = 8) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => clampLen(x, 300)) : [];

function detectScript(text) {
  const t = String(text || '').slice(0, 500);
  if (!t) return 'unknown';
  if (/[ऀ-ॿ]/.test(t)) return 'hi';
  if (/[ঀ-෿଀-௿ఀ-౿ಀ-೿]/.test(t)) return 'indic';
  if (/[A-Za-z]/.test(t)) return 'en';
  return 'unknown';
}

function cosine(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function withRetry(label, fn, retries = 3, baseMs = 600) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const wait = baseMs * 2 ** i + Math.floor(Math.random() * 200);
      console.warn(`  [${label}] attempt ${i + 1} failed: ${e.message}. retry in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const first = text.indexOf('{');
  const firstArr = text.indexOf('[');
  const start = first === -1 ? firstArr : firstArr === -1 ? first : Math.min(first, firstArr);
  if (start === -1) return text.trim();
  const last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (last <= start) return text.slice(start).trim();
  return text.slice(start, last + 1).trim();
}

function repairTruncatedJson(text) {
  let s = String(text || '').trim();
  if (!s) return s;
  let inStr = false, escape = false, lastSafe = 0;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; if (!inStr) lastSafe = i + 1; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' && stack[stack.length - 1] === '{') { stack.pop(); lastSafe = i + 1; }
    else if (ch === ']' && stack[stack.length - 1] === '[') { stack.pop(); lastSafe = i + 1; }
    else if (ch === ',' || /\s/.test(ch)) lastSafe = i + 1;
  }
  let trimmed = s.slice(0, lastSafe).replace(/[,\s]+$/, '');
  inStr = false; escape = false;
  const stack2 = [];
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') stack2.push(ch);
    else if (ch === '}' && stack2[stack2.length - 1] === '{') stack2.pop();
    else if (ch === ']' && stack2[stack2.length - 1] === '[') stack2.pop();
  }
  while (stack2.length) {
    const open = stack2.pop();
    trimmed += open === '{' ? '}' : ']';
  }
  return trimmed;
}

const FALLBACK_CHAT_MODEL = (process.env.SARVAM_FALLBACK_CHAT_MODEL || 'sarvam-m').trim();

async function chatJson(systemPrompt, userPrompt, { maxTokens = 2400, temperature = 0.2, retries = 2, model = CHAT_MODEL } = {}) {
  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];
  let lastContent = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { content, finishReason } = await withRetry('chat', async () => {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': SARVAM_KEY,
          Authorization: `Bearer ${SARVAM_KEY}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`chat http ${res.status}: ${body.slice(0, 200)}`);
      }
      const body = await res.json();
      const choice = body?.choices?.[0];
      const text = String(choice?.message?.content ?? choice?.text ?? body?.output_text ?? body?.content ?? '');
      return { content: text, finishReason: choice?.finish_reason || null };
    }, 3);
    lastContent = content;
    if (!content?.trim()) {
      if (attempt === retries) throw new Error(`chat returned empty content (finish_reason=${finishReason})`);
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt + '\n\nRespond now with valid JSON only.' },
      ];
      continue;
    }
    const block = extractJson(content);
    try { return JSON.parse(block); } catch {
      try { return JSON.parse(repairTruncatedJson(block)); } catch (e2) {
        if (attempt === retries) throw new Error(`chat json parse failed: ${e2.message}\nraw: ${content.slice(0, 600)}`);
        messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
          { role: 'assistant', content },
          { role: 'user',   content: 'Your previous response was not valid JSON. Return ONLY a single valid JSON object that matches the schema. Keep arrays short. No code fences.' },
        ];
      }
    }
  }
  return JSON.parse(extractJson(lastContent));
}

async function chatJsonWithFallback(systemPrompt, userPrompt, opts = {}) {
  try {
    return await chatJson(systemPrompt, userPrompt, opts);
  } catch (err) {
    if (FALLBACK_CHAT_MODEL && FALLBACK_CHAT_MODEL !== CHAT_MODEL && /empty content|finish_reason=length|json parse failed/i.test(err.message)) {
      console.warn(`[chat] primary model failed (${err.message.slice(0, 120)}); retrying with fallback ${FALLBACK_CHAT_MODEL}`);
      return await chatJson(systemPrompt, userPrompt, { ...opts, model: FALLBACK_CHAT_MODEL });
    }
    throw err;
  }
}

// Sarvam does not offer a public embeddings API. We use Transformers.js with a
// multilingual sentence-transformer (Xenova/paraphrase-multilingual-MiniLM-L12-v2,
// 384-dim, supports Hindi + Indic). Model is downloaded once on first use, then
// cached by the library. Embedding runs entirely on the local Node server.
const EMBED_TRANSFORMER_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
let EMBEDDINGS_AVAILABLE = null;
let embedderPromise = null;

async function getEmbedder() {
  if (embedderPromise) return embedderPromise;
  embedderPromise = (async () => {
    try {
      console.log(`[embed] loading ${EMBED_TRANSFORMER_MODEL} (first run downloads ~80MB)...`);
      const t0 = Date.now();
      const { pipeline, env: tfEnv } = await import('@xenova/transformers');
      tfEnv.allowRemoteModels = true;
      const fn = await pipeline('feature-extraction', EMBED_TRANSFORMER_MODEL);
      console.log(`[embed] model ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      EMBEDDINGS_AVAILABLE = true;
      return fn;
    } catch (err) {
      console.warn(`[embed] failed to load Transformers.js model: ${err.message}`);
      EMBEDDINGS_AVAILABLE = false;
      throw err;
    }
  })();
  return embedderPromise;
}

async function embedBatch(texts) {
  if (!texts.length) return [];
  let embedder;
  try {
    embedder = await getEmbedder();
  } catch {
    return texts.map(() => []);
  }
  const out = [];
  // Process one-at-a-time to keep memory bounded; the model is fast enough.
  for (const text of texts) {
    const trimmed = String(text || ' ').slice(0, 6000) || ' ';
    try {
      const result = await embedder(trimmed, { pooling: 'mean', normalize: true });
      out.push(Array.from(result.data));
    } catch (err) {
      console.warn(`[embed] failed on text: ${err.message}`);
      out.push([]);
    }
  }
  return out;
}

// ── prompts (mirror of supabase/functions/.../_lib/prompts.ts) ──────────────
const EXTRACT_AND_PAIR_SYSTEM = `Extract numbered questions from CBSE/ICSE texts. Output minified JSON only, no fences, no commentary.
Accept "Q1","1.","1)","I.","II." and Devanagari numerals. Pair by question number.
Cap question_text/model_answer/student_answer at 200 chars EACH. Default max_marks=5.
Emit AT MOST 15 questions. If text is OCR noise, still extract whatever readable numbered items you can find.
If ANSWER_KEY ≈ STUDENT_ANSWER text, set model_answer="" and add "answer_key_same_as_student" to warnings.
Schema (no other fields): {"warnings":[],"questions":[{"n":"1","q":"...","m":"...","s":"...","mm":5}]}`;

const JUDGE_SYSTEM = `You are an experienced CBSE/ICSE examiner. Grade ONE answer using the rubric.
Output ONLY valid JSON, minified, no whitespace. No code fences, no commentary. Be strict but fair.
Keep exemplar_answer under 400 chars, suggested_format under 200 chars, reasoning under 200 chars.
Keep each list (key_concepts_present, missed_concepts, factual_errors, structural_issues, improvement_areas) at most 3 short items.

Rubric (apply by content match against the model answer when one exists,
otherwise grade against the question and your subject knowledge):
  0           blank, completely irrelevant, or copies the question verbatim
  20% of max  one key term mentioned, no real understanding
  40% of max  partial concept present, major gap or error
  60% of max  correct concept, missing detail or structure
  80% of max  correct and well-structured, with minor errors
  100% of max complete, accurate, well-formatted, exam-ready

CRITICAL:
- If MODEL_ANSWER is empty or "(not provided)", grade strictly using the QUESTION and your own knowledge of the subject.
  Do NOT assume the student's answer is correct. Cap confidence at 0.6 in this mode.
- If STUDENT_ANSWER is blank, repeats the question verbatim, or is clearly off-topic from the question, score 0.
- Never claim "the student's answer matches the model answer" when MODEL_ANSWER is empty.

For "exemplar_answer", produce a 100% model student response in the same language as the student's answer (plain prose, no markdown).
For "suggested_format", give one paragraph of structural advice.
"reasoning" is a single sentence justifying the score.

Schema: { "score": number, "key_concepts_present": string[], "missed_concepts": string[],
"factual_errors": string[], "structural_issues": string[], "improvement_areas": string[],
"suggested_format": string, "exemplar_answer": string, "subtopic": string,
"bloom_level": "Remember"|"Understand"|"Apply"|"Analyze"|"Evaluate"|"Create",
"confidence": number, "reasoning": string }`;

const PLAN_SYSTEM = `You are a supportive CBSE/ICSE study coach writing to a school student.
Output ONLY valid JSON. No code fences, no commentary.
Tone: warm, second-person, concrete, age-appropriate.
plan_text: 3 short paragraphs (strengths, weaknesses, next steps).
topic_breakdown: aggregate per topic, mastery in [0,1].
tasks: 3-5 items, each actionable in 15-45 minutes.

Schema: { "plan_text": string, "weak_topics": string[],
"topic_breakdown": [{"topic": string, "mastery": number, "missed": string[], "focus": string}],
"tasks": [{"title": string, "why": string, "how": string, "est_minutes": number}] }`;

function judgeUserPrompt(q, lang) {
  const langHint = lang === 'hi' ? 'The student\'s answer is in Hindi. Grade as written.'
    : lang === 'indic' ? 'The student\'s answer is in an Indic language. Grade as written.'
    : 'Grade in English.';
  return [
    `QUESTION_NO: ${q.question_no}`,
    `TOPIC: ${q.topic || 'general'}`,
    `MAX_MARKS: ${q.max_marks}`,
    `KEY_CONCEPTS: ${(q.key_concepts || []).join(', ') || '(not provided)'}`,
    `LANGUAGE_HINT: ${langHint}`,
    '',
    'QUESTION:', q.question_text || '(not provided)',
    '',
    'MODEL_ANSWER:', q.model_answer || '(not provided)',
    '',
    'STUDENT_ANSWER:', q.student_answer || '(blank)',
  ].join('\n');
}

function calibrate({ llmScore, maxMarks, similarity, questionSimilarity, confidence, crossLingual }) {
  const reasons = [];
  const max = Math.max(1, maxMarks);
  const llmRatio = Math.max(0, Math.min(1, llmScore / max));
  const sim = Math.max(0, Math.min(1, similarity));
  const qSim = Math.max(0, Math.min(1, questionSimilarity));
  const disagreementThreshold = crossLingual ? 0.55 : 0.4;
  const plagiarism = sim <= qSim + 0.1 && qSim > 0.4 && llmScore > 0;
  if (plagiarism) reasons.push('answer too similar to the question text');
  const disagreement = Math.abs(llmRatio - sim) > disagreementThreshold;
  if (disagreement) reasons.push('LLM and semantic similarity disagree');
  if (confidence < 0.6) reasons.push(`low LLM confidence (${confidence.toFixed(2)})`);
  let finalScore = llmScore;
  if (plagiarism) finalScore = Math.min(llmScore, max * 0.2);
  finalScore = Math.max(0, Math.min(max, Math.round(finalScore * 100) / 100));
  return { finalScore, needsReview: plagiarism || disagreement || confidence < 0.6, reasons };
}

// ── input sanity checks ─────────────────────────────────────────────────────
function normaliseForCompare(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function jaccardWordOverlap(a, b) {
  const wa = new Set(normaliseForCompare(a).split(' ').filter((w) => w.length > 2));
  const wb = new Set(normaliseForCompare(b).split(' ').filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.min(wa.size, wb.size);
}

function preflightWarnings({ questionPaper, answerKey, studentAnswer }) {
  const warnings = [];
  const trimmedKey = String(answerKey || '').trim();
  if (!trimmedKey) warnings.push('answer_key_empty');

  // If the answer key shares almost no terms with the question paper AND the student answer,
  // it is probably a completely different document (e.g. someone uploaded a résumé as the key).
  // We deliberately do NOT flag "answer_key_same_as_student" — if a teacher uploads the same
  // content for both, the student literally has the model answer and should score 100%.
  const akVsStudent = jaccardWordOverlap(answerKey, studentAnswer);
  const akVsQp = jaccardWordOverlap(answerKey, questionPaper);
  if (trimmedKey && questionPaper.trim() && akVsQp < 0.05 && akVsStudent < 0.1) {
    warnings.push('answer_key_unrelated');
  }
  return warnings;
}

// ── pipeline ────────────────────────────────────────────────────────────────
async function evaluatePipeline({ questionPaper, answerKey, studentAnswer }) {
  const t0 = Date.now();

  const preWarnings = preflightWarnings({ questionPaper, answerKey, studentAnswer });
  const noReference = preWarnings.includes('answer_key_empty')
    || preWarnings.includes('answer_key_unrelated')
    || preWarnings.includes('answer_key_same_as_student');

  // If the answer key is unusable, do not send it to the extractor — it would just
  // tempt the LLM to fabricate model answers. Pass an explicit marker instead.
  const answerKeyForExtractor = noReference ? '(not provided — grade without reference)' : answerKey;

  // Hard-trim inputs to keep total prompt under starter-tier budget.
  // Devanagari is ~3x denser in tokens than English; 2500 chars ≈ 1500 tokens per field.
  const TRIM = 2500;
  const qpTrim     = clampLen(questionPaper, TRIM);
  const keyTrim    = clampLen(answerKeyForExtractor, TRIM);
  const studentTrim = clampLen(studentAnswer, TRIM);

  console.log(`[extract] inputs preview (trimmed to ${TRIM}c each):`);
  console.log(`  qp     : ${qpTrim.slice(0, 160).replace(/\s+/g, ' ')}`);
  console.log(`  key    : ${keyTrim.slice(0, 160).replace(/\s+/g, ' ')}`);
  console.log(`  student: ${studentTrim.slice(0, 160).replace(/\s+/g, ' ')}`);

  const parsed = await chatJsonWithFallback(EXTRACT_AND_PAIR_SYSTEM, [
    'QUESTION_PAPER:', qpTrim || '(empty)', '',
    'ANSWER_KEY:', keyTrim || '(empty)', '',
    'STUDENT_ANSWER:', studentTrim || '(empty)',
  ].join('\n'), { maxTokens: 4000, temperature: 0.1 });

  console.log(`[extract] parsed keys: ${Object.keys(parsed || {}).join(',')} · questions=${(parsed?.questions || []).length} · warnings=${JSON.stringify(parsed?.warnings || parsed?.input_warnings || [])}`);
  if (!parsed?.questions?.length) {
    console.log(`[extract] EMPTY questions — raw parsed: ${JSON.stringify(parsed).slice(0, 500)}`);
  }

  const llmWarnings = Array.isArray(parsed?.warnings || parsed?.input_warnings)
    ? (parsed.warnings || parsed.input_warnings).filter((w) => typeof w === 'string')
    : [];
  const allWarnings = Array.from(new Set([...preWarnings, ...llmWarnings]));

  const questions = (parsed?.questions || []).map((q, i) => {
    // Accept both short keys ({n,q,m,s,mm}) and the older long keys ({question_no,...}).
    const qNo  = q.n ?? q.question_no;
    const qTxt = q.q ?? q.question_text;
    const mAns = q.m ?? q.model_answer;
    const sAns = q.s ?? q.student_answer;
    const mMrk = q.mm ?? q.max_marks;
    let modelAnswer = clampLen(mAns || '', 1500);
    const studentAns = clampLen(sAns || '', 1500);
    if (noReference) modelAnswer = '';
    return {
      question_no: String(qNo || `Q${i + 1}`).trim(),
      question_text: clampLen(qTxt || '', 1500),
      model_answer: modelAnswer,
      max_marks: Math.max(1, Math.round(safeNumber(mMrk, 5))),
      topic: clampLen(q.topic || 'general', 120),
      key_concepts: safeStrArr(q.key_concepts),
      student_answer: studentAns,
      student_answer_present: q.student_answer_present !== false && Boolean(studentAns.trim()),
      alignment_confidence: Math.max(0, Math.min(1, safeNumber(q.alignment_confidence, 0.7))),
    };
  });

  const texts = [];
  for (const q of questions) {
    texts.push(q.model_answer || q.question_text || q.topic);
    texts.push(q.student_answer || '(blank)');
    texts.push(q.question_text || q.topic);
  }
  const embeddings = await embedBatch(texts);

  // Grade questions in parallel batches to cut wall-clock time. Sarvam starter
  // tier handles ~4 concurrent chat calls comfortably; tune via JUDGE_CONCURRENCY.
  const JUDGE_CONCURRENCY = Math.max(1, Number(process.env.JUDGE_CONCURRENCY || 4));

  async function gradeOne(q, i) {
    const lang = detectScript(q.student_answer);
    const modelLang = detectScript(q.model_answer || q.question_text);
    const similarity         = cosine(embeddings[i*3+1] || [], embeddings[i*3]   || []);
    const questionSimilarity = cosine(embeddings[i*3+1] || [], embeddings[i*3+2] || []);

    if (!q.student_answer_present) {
      return { q, lang, modelLang, similarity, questionSimilarity, judgment: {
        score: 0, key_concepts_present: [], missed_concepts: q.key_concepts,
        factual_errors: [], structural_issues: [], improvement_areas: ['Attempt the question.'],
        suggested_format: 'Begin with a definition, list the key concepts, support with one example.',
        exemplar_answer: q.model_answer || '', subtopic: q.topic, bloom_level: 'Remember',
        confidence: 1, reasoning: 'Question not attempted by the student.',
      }, calibration: { finalScore: 0, needsReview: false, reasons: ['question not attempted'] } };
    }

    const judgmentRaw = await chatJsonWithFallback(JUDGE_SYSTEM, judgeUserPrompt(q, lang), { maxTokens: 3500, temperature: 0.2 });
    const judgment = {
      score: Math.max(0, Math.min(q.max_marks, safeNumber(judgmentRaw.score, 0))),
      key_concepts_present: safeStrArr(judgmentRaw.key_concepts_present),
      missed_concepts: safeStrArr(judgmentRaw.missed_concepts),
      factual_errors: safeStrArr(judgmentRaw.factual_errors),
      structural_issues: safeStrArr(judgmentRaw.structural_issues),
      improvement_areas: safeStrArr(judgmentRaw.improvement_areas),
      suggested_format: clampLen(judgmentRaw.suggested_format, 1500),
      exemplar_answer: clampLen(judgmentRaw.exemplar_answer, 2500),
      subtopic: clampLen(judgmentRaw.subtopic || q.topic, 120),
      bloom_level: judgmentRaw.bloom_level || 'Understand',
      confidence: Math.max(0, Math.min(1, safeNumber(judgmentRaw.confidence, 0.6))),
      reasoning: clampLen(judgmentRaw.reasoning, 600),
    };
    if (noReference) judgment.confidence = Math.min(judgment.confidence, 0.5);
    const calibration = calibrate({
      llmScore: judgment.score, maxMarks: q.max_marks,
      similarity, questionSimilarity, confidence: judgment.confidence,
      crossLingual: lang !== modelLang && lang !== 'unknown' && modelLang !== 'unknown',
    });
    if (noReference && !calibration.reasons.includes('graded without reference answer')) {
      calibration.reasons.push('graded without reference answer');
      calibration.needsReview = true;
    }
    return { q, lang, modelLang, similarity, questionSimilarity, judgment, calibration };
  }

  const rows = new Array(questions.length);
  let nextIdx = 0;
  const tJudge = Date.now();
  console.log(`[judge] grading ${questions.length} questions with concurrency=${JUDGE_CONCURRENCY}`);
  await Promise.all(
    Array.from({ length: Math.min(JUDGE_CONCURRENCY, questions.length) }, async () => {
      while (true) {
        const i = nextIdx++;
        if (i >= questions.length) return;
        try {
          rows[i] = await gradeOne(questions[i], i);
        } catch (e) {
          console.warn(`[judge] q${questions[i].question_no} failed: ${e.message}`);
          rows[i] = {
            q: questions[i], lang: 'unknown', modelLang: 'unknown', similarity: 0, questionSimilarity: 0,
            judgment: { score: 0, key_concepts_present: [], missed_concepts: [], factual_errors: [], structural_issues: [], improvement_areas: [], suggested_format: '', exemplar_answer: '', subtopic: questions[i].topic, bloom_level: 'Remember', confidence: 0, reasoning: `Grading failed: ${e.message.slice(0, 200)}` },
            calibration: { finalScore: 0, needsReview: true, reasons: ['judge call failed'] },
          };
        }
      }
    })
  );
  console.log(`[judge] done in ${((Date.now() - tJudge) / 1000).toFixed(1)}s`);

  const obtained = rows.reduce((a, r) => a + r.calibration.finalScore, 0);
  const totalMax = rows.reduce((a, r) => a + r.q.max_marks, 0) || 1;
  const percentage = Math.round((obtained / totalMax) * 100);

  const planUserPrompt = [
    `TEST: Demo evaluation`,
    `TOTAL: ${obtained}/${totalMax}`,
    '',
    'PER-QUESTION SUMMARY:',
    ...rows.map((r) => `- ${r.q.question_no} (${r.q.topic}): ${r.calibration.finalScore}/${r.q.max_marks} | got: ${r.judgment.key_concepts_present.slice(0, 4).join('; ') || 'none'} | missed: ${r.judgment.missed_concepts.slice(0, 4).join('; ') || 'none'}`),
  ].join('\n');
  let plan = null;
  try {
    plan = await chatJsonWithFallback(PLAN_SYSTEM, planUserPrompt, { maxTokens: 3500, temperature: 0.4 });
  } catch (e) {
    console.warn(`[plan] synthesis failed: ${e.message}`);
  }

  // Reshape into the same shape EvaluationDetailReport expects (mirrors DB rows)
  const resultId = randomUUID();
  const questionRows = rows.map((r) => {
    const id = randomUUID();
    const reasoning = r.calibration.reasons.length
      ? `${r.judgment.reasoning} (${r.calibration.reasons.join('; ')})`
      : r.judgment.reasoning;
    return {
      id,
      question_no: r.q.question_no,
      max_score: r.q.max_marks,
      score: r.calibration.finalScore,
      original_ai_score: r.calibration.finalScore,
      teacher_override_score: null,
      override_reason: null,
      llm_score: r.judgment.score,
      semantic_similarity: Number(r.similarity.toFixed(4)),
      confidence: Number((r.judgment.confidence ?? 0.5).toFixed(2)),
      alignment_confidence: Number(r.q.alignment_confidence.toFixed(2)),
      needs_review: r.calibration.needsReview,
      review_reasons: r.calibration.reasons,
      extracted_answer: r.q.student_answer,
      evaluator_reasoning: reasoning,
      strengths: r.judgment.key_concepts_present,
      weaknesses: r.judgment.missed_concepts,
      rubric: { rubric_band: r.calibration.finalScore / Math.max(1, r.q.max_marks) },
      question_text: r.q.question_text,
      model_answer: r.q.model_answer,
      student_answer_present: r.q.student_answer_present,
      topic: r.q.topic,
      subtopic: r.judgment.subtopic,
      bloom_level: r.judgment.bloom_level,
      student_lang: r.lang,
      model_lang: r.modelLang,
      created_at: new Date().toISOString(),
      feedback: {
        question_score_id: id,
        key_concepts_present: r.judgment.key_concepts_present,
        missed_concepts: r.judgment.missed_concepts,
        factual_errors: r.judgment.factual_errors,
        structural_issues: r.judgment.structural_issues,
        improvement_areas: r.judgment.improvement_areas,
        suggested_format: r.judgment.suggested_format,
        exemplar_answer: r.judgment.exemplar_answer,
      },
    };
  });

  return {
    elapsedMs: Date.now() - t0,
    embeddingsAvailable: EMBEDDINGS_AVAILABLE === true,
    degraded: EMBEDDINGS_AVAILABLE !== true || noReference,
    inputWarnings: allWarnings,
    noReference,
    result: {
      id: resultId,
      student_id: null,
      test_id: null,
      marks: obtained,
      percentage,
      created_at: new Date().toISOString(),
    },
    questions: questionRows,
    plan,
  };
}

// ── HTTP server ─────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function readBody(req, limit = 5_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const cors = corsHeaders(origin);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sarvamConfigured: Boolean(SARVAM_KEY), embeddings: EMBEDDINGS_AVAILABLE }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/evaluate') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      const { questionPaper = '', answerKey = '', studentAnswer = '', ids = null, fileNames = null } = payload;
      if (!String(studentAnswer).trim()) {
        res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'studentAnswer is required' }));
        return;
      }
      console.log(`[evaluate] qp=${questionPaper.length}c key=${answerKey.length}c student=${studentAnswer.length}c · ids=${JSON.stringify(ids || {})}`);
      const out = await evaluatePipeline({ questionPaper, answerKey, studentAnswer });
      console.log(`[evaluate] done in ${(out.elapsedMs / 1000).toFixed(1)}s · ${out.result.marks}/${out.questions.reduce((a, q) => a + q.max_score, 0)}`);

      let persistence = { saved: false, reason: 'not_attempted' };
      if (ids && supabaseAdmin) {
        try {
          persistence = await persistEvaluation({ pipelineOut: out, ids: { ...ids, fileNames } });
          console.log(`[supabase] persisted: result=${persistence.resultId} job=${persistence.jobId}`);
        } catch (e) {
          console.error(`[supabase] persistence failed: ${e.message}`);
          persistence = { saved: false, reason: 'error', error: e.message };
        }
      }

      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...out, persistence }));
    } catch (err) {
      console.error('[evaluate] error', err);
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || String(err) }));
    }
    return;
  }

  res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`local evaluation server listening on http://127.0.0.1:${PORT}`);
  console.log(`  - POST /api/evaluate`);
  console.log(`  - GET  /api/health`);
  console.log(`  - allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`  - chat: ${CHAT_URL} (${CHAT_MODEL})`);
  console.log(`  - embed: Transformers.js / ${EMBED_TRANSFORMER_MODEL} (local, multilingual)`);
});
