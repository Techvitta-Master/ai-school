/**
 * dry-run-evaluation.mjs
 * Exercises the semantic evaluation pipeline against Sarvam ONLY.
 * No Supabase calls. No DB writes. Pure end-to-end check that:
 *   - extract+pair prompt parses Q&A correctly
 *   - Sarvam embeddings produce sensible cosine similarity
 *   - per-question rubric grading yields structured feedback
 *   - score calibration / plagiarism guard work
 *   - improvement plan synthesis works
 *
 * Usage:
 *   node scripts/dry-run-evaluation.mjs [scenario]
 *
 * Scenarios: strong | offtopic | plagiarism | multilingual | custom
 *   "custom" reads three text files: --qp, --key, --student
 *
 * Reads SARVAM_* env vars from .env if present.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── tiny .env loader ────────────────────────────────────────────────────────
function loadDotenv() {
  const path = resolve(__dirname, '../.env');
  try {
    const raw = readFileSync(path, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  } catch { /* no .env — that's fine */ }
}
loadDotenv();

const SARVAM_KEY   = (process.env.SARVAM_API_SUBSCRIPTION_KEY || '').trim();
const CHAT_URL     = (process.env.SARVAM_CHAT_URL || 'https://api.sarvam.ai/v1/chat/completions').trim();
const CHAT_MODEL   = (process.env.SARVAM_CHAT_MODEL || 'sarvam-105b').trim();
const EMBED_URL    = (process.env.SARVAM_EMBEDDING_URL || 'https://api.sarvam.ai/v1/embeddings').trim();
const EMBED_MODEL  = (process.env.SARVAM_EMBEDDING_MODEL || 'sarvam-embedding-v1').trim();

if (!SARVAM_KEY) {
  console.error('Missing SARVAM_API_SUBSCRIPTION_KEY in env / .env');
  process.exit(1);
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
      console.warn(`  [${label}] attempt ${i + 1} failed: ${e.message}. retrying in ${wait}ms`);
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

// Best-effort closer for responses that got cut off at max_tokens. Walks the string,
// tracks unmatched {[(", trims trailing partial tokens, and appends the right closers.
function repairTruncatedJson(text) {
  let s = String(text || '').trim();
  if (!s) return s;
  // Strip any unterminated trailing string fragment (e.g. `..."improvement_are`)
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
  // Truncate to last balanced position so we don't leave a half-key/half-value
  let trimmed = s.slice(0, lastSafe).replace(/[,\s]+$/, '');
  // Re-walk to compute remaining open brackets after trimming
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

async function chatJson(systemPrompt, userPrompt, { maxTokens = 2400, temperature = 0.2, retries = 2 } = {}) {
  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];
  let lastContent = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { content, finishReason, rawBody } = await withRetry('chat', async () => {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': SARVAM_KEY,
          Authorization: `Bearer ${SARVAM_KEY}`,
        },
        body: JSON.stringify({ model: CHAT_MODEL, messages, max_tokens: maxTokens, temperature }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`chat http ${res.status}: ${body.slice(0, 200)}`);
      }
      const body = await res.json();
      const choice = body?.choices?.[0];
      const text = String(
        choice?.message?.content ??
        choice?.text ??
        body?.output_text ??
        body?.content ??
        ''
      );
      return { content: text, finishReason: choice?.finish_reason || null, rawBody: body };
    }, 3);
    lastContent = content;
    if (!content || !content.trim()) {
      if (attempt === retries) {
        throw new Error(`chat returned empty content (finish_reason=${finishReason}). raw: ${JSON.stringify(rawBody).slice(0, 500)}`);
      }
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt + '\n\nRespond now with valid JSON only.' },
      ];
      continue;
    }
    const block = extractJson(content);
    try {
      return JSON.parse(block);
    } catch {
      // Try repairing a truncated response (common when finish_reason=length)
      try {
        const repaired = repairTruncatedJson(block);
        const parsed = JSON.parse(repaired);
        if (finishReason === 'length') console.log(c('yellow', `   (recovered truncated response)`));
        return parsed;
      } catch (e2) {
        if (attempt === retries) throw new Error(`chat json parse failed: ${e2.message}\nfinish_reason=${finishReason}\nraw: ${content.slice(0, 600)}`);
        messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
          { role: 'assistant', content },
          { role: 'user',   content: 'Your previous response was not valid JSON. Return ONLY a single valid JSON object that matches the schema. Keep arrays short. No code fences, no commentary.' },
        ];
      }
    }
  }
  return JSON.parse(extractJson(lastContent));
}

// Sarvam exposes embeddings under a few historical paths depending on tenant. Try the configured
// URL first, then well-known fallbacks. The first 200/2xx wins and is cached for the rest of the run.
const EMBED_URL_CANDIDATES = Array.from(new Set([
  EMBED_URL,
  'https://api.sarvam.ai/v1/embeddings',
  'https://api.sarvam.ai/sarvam-embedding/v1',
  'https://api.sarvam.ai/sarvam-embed/v1',
  'https://api.sarvam.ai/text-embedding/v1',
  'https://api.sarvam.ai/embeddings',
].filter(Boolean)));

let RESOLVED_EMBED_URL = null;

const SARVAM_BODY_VARIANTS = (texts) => [
  // OpenAI-compatible
  { model: EMBED_MODEL, input: texts },
  // Sarvam legacy
  { inputs: texts, model: EMBED_MODEL },
  // Single-input (some Sarvam versions only accept one text per call — caller will batch)
  ...(texts.length === 1 ? [{ text: texts[0] }] : []),
];

async function embedSingleAttempt(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': SARVAM_KEY,
      Authorization: `Bearer ${SARVAM_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, status: res.status, body: txt.slice(0, 200) };
  }
  const json = await res.json();
  const data = json?.data || json?.embeddings || (json?.embedding ? [{ embedding: json.embedding }] : []);
  const vectors = data.map((row) =>
    Array.isArray(row.embedding) ? row.embedding :
    Array.isArray(row.values) ? row.values :
    Array.isArray(row) ? row :
    []
  );
  return { ok: true, vectors };
}

async function resolveEmbedUrl(probeText = 'hello') {
  if (RESOLVED_EMBED_URL) return RESOLVED_EMBED_URL;
  for (const url of EMBED_URL_CANDIDATES) {
    for (const body of SARVAM_BODY_VARIANTS([probeText])) {
      const r = await embedSingleAttempt(url, body);
      if (r.ok && r.vectors.length && r.vectors[0].length) {
        RESOLVED_EMBED_URL = url;
        console.log(c('dim', `   resolved embed endpoint → ${url}  (dim=${r.vectors[0].length})`));
        return url;
      }
    }
  }
  return null;
}

async function embedBatch(texts) {
  if (!texts.length) return [];
  const url = await resolveEmbedUrl(texts[0] || 'hello');
  if (!url) throw new Error(`no embedding endpoint matched. tried: ${EMBED_URL_CANDIDATES.join(', ')}`);

  // Try batch first
  for (const body of SARVAM_BODY_VARIANTS(texts.map((t) => t.slice(0, 6000) || ' '))) {
    const r = await embedSingleAttempt(url, body);
    if (r.ok && r.vectors.length === texts.length && r.vectors[0]?.length) return r.vectors;
  }
  // Fallback: one-by-one
  const out = [];
  for (const t of texts) {
    const trimmed = t.slice(0, 6000) || ' ';
    let last = null;
    for (const body of SARVAM_BODY_VARIANTS([trimmed])) {
      const r = await embedSingleAttempt(url, body);
      if (r.ok && r.vectors[0]?.length) { last = r.vectors[0]; break; }
    }
    out.push(last || []);
  }
  return out;
}

// ── prompts (mirrored from supabase/functions/.../_lib/prompts.ts) ──────────
const EXTRACT_AND_PAIR_SYSTEM = `You are a strict JSON extractor for a CBSE/ICSE-style school grading system.
You will receive three OCR-extracted texts: a question paper, an answer key, and a student's answer sheet.
Your job is to produce a single JSON object pairing each question with its model answer and the student's response.

Rules:
1. Output ONLY valid JSON, no commentary, no code fences.
2. Pair items by normalised question number. Accept "Q1", "1.", "1)", "1(a)", Roman numerals, and Devanagari numerals.
3. If the question paper is missing or empty, derive question_text from the answer key context.
4. If a question has no student answer, emit it with student_answer_present=false and student_answer="".
5. Never invent questions. If unsure, lower alignment_confidence.
6. Default max_marks to 5 when not specified.
7. Keep model_answer verbatim from the answer key.
8. Cap each text field at 1500 characters.

Schema:
{
  "questions": [
    {
      "question_no": string,
      "question_text": string,
      "model_answer": string,
      "max_marks": integer,
      "topic": string,
      "key_concepts": string[],
      "student_answer": string,
      "student_answer_present": boolean,
      "alignment_confidence": number
    }
  ]
}`;

const JUDGE_SYSTEM = `You are an experienced CBSE/ICSE examiner. Grade ONE answer using the rubric below.
Output ONLY valid JSON. No commentary, no code fences. Be strict but fair.

Rubric (apply by content match against the model answer):
  0           blank or completely irrelevant
  20% of max  one key term mentioned, no real understanding
  40% of max  partial concept present, major gap or error
  60% of max  correct concept, missing detail or structure
  80% of max  correct and well-structured, with minor errors
  100% of max complete, accurate, well-formatted, exam-ready

For "exemplar_answer", produce a model student response that would score 100% — written in the same language as the student's answer, in plain prose suitable for a school answer sheet (no markdown).
For "suggested_format", give one paragraph of concrete structural advice.
"reasoning" is a single sentence justifying the score.

Schema:
{
  "score": number,
  "key_concepts_present": string[],
  "missed_concepts": string[],
  "factual_errors": string[],
  "structural_issues": string[],
  "improvement_areas": string[],
  "suggested_format": string,
  "exemplar_answer": string,
  "subtopic": string,
  "bloom_level": "Remember"|"Understand"|"Apply"|"Analyze"|"Evaluate"|"Create",
  "confidence": number,
  "reasoning": string
}`;

const PLAN_SYSTEM = `You are a supportive CBSE/ICSE study coach writing to a school student.
Given per-question grading judgments, produce a concise improvement plan in JSON.
Output ONLY valid JSON. No commentary, no code fences.

Tone: warm, second-person ("you"), concrete, age-appropriate (Class 6-12).
plan_text: 3 short paragraphs (strengths, weaknesses, next steps).
topic_breakdown: aggregate per topic, mastery in [0,1].
tasks: 3-5 items, each actionable in 15-45 minutes.

Schema:
{
  "plan_text": string,
  "weak_topics": string[],
  "topic_breakdown": [{"topic": string, "mastery": number, "missed": string[], "focus": string}],
  "tasks": [{"title": string, "why": string, "how": string, "est_minutes": number}]
}`;

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

// ── score calibration (mirrored from _lib/score.ts) ─────────────────────────
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

// ── scenarios ──────────────────────────────────────────────────────────────
const SCENARIOS = {
  strong: {
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)
Q2. Explain Newton's second law with one real-world example. (5 marks)`,
    answerKey: `Q1. Photosynthesis is the process by which green plants use sunlight to convert carbon dioxide and water into glucose and oxygen. The balanced equation is: 6CO2 + 6H2O -> C6H12O6 + 6O2 (in presence of sunlight and chlorophyll).
Q2. Newton's second law states that the force on an object equals its mass times its acceleration (F = ma). Example: pushing a heavier shopping trolley needs more force to reach the same speed.`,
    studentAnswer: `Q1. Photosynthesis is when plants make food using sunlight. They take in carbon dioxide and water, and release oxygen and glucose. Equation: 6CO2 + 6H2O -> C6H12O6 + 6O2 with help of sunlight and chlorophyll.
Q2. Newton's second law: F = m * a. The force needed depends on mass times acceleration. Example: kicking a heavy football needs more force than a light one to make it move at the same speed.`,
  },
  offtopic: {
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)
Q2. Explain Newton's second law with one real-world example. (5 marks)`,
    answerKey: `Q1. Photosynthesis... 6CO2 + 6H2O -> C6H12O6 + 6O2.
Q2. F = ma.`,
    studentAnswer: `Q1. Volcanoes erupt when magma rises through the crust. There are shield volcanoes and stratovolcanoes.
Q2. Mount Everest is the tallest mountain in the world.`,
  },
  plagiarism: {
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)`,
    answerKey: `Q1. Photosynthesis is the process by which green plants use sunlight to convert carbon dioxide and water into glucose and oxygen. 6CO2 + 6H2O -> C6H12O6 + 6O2.`,
    studentAnswer: `Q1. Define photosynthesis and write its balanced chemical equation.`,
  },
  multilingual: {
    questionPaper: `Q1. Define photosynthesis and write its balanced chemical equation. (5 marks)`,
    answerKey: `Q1. Photosynthesis: green plants make glucose from CO2 and water using sunlight. 6CO2 + 6H2O -> C6H12O6 + 6O2.`,
    studentAnswer: `Q1. प्रकाश संश्लेषण वह प्रक्रिया है जिसमें हरे पौधे सूर्य के प्रकाश की उपस्थिति में कार्बन डाइऑक्साइड और पानी से ग्लूकोज और ऑक्सीजन बनाते हैं। समीकरण: 6CO2 + 6H2O -> C6H12O6 + 6O2.`,
  },
};

function loadCustom() {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : null;
  };
  const qp = get('--qp');
  const key = get('--key');
  const student = get('--student');
  if (!qp || !key || !student) {
    console.error('custom scenario needs --qp <file> --key <file> --student <file>');
    process.exit(1);
  }
  return {
    questionPaper: readFileSync(resolve(process.cwd(), qp), 'utf-8'),
    answerKey: readFileSync(resolve(process.cwd(), key), 'utf-8'),
    studentAnswer: readFileSync(resolve(process.cwd(), student), 'utf-8'),
  };
}

// ── main ───────────────────────────────────────────────────────────────────
const scenarioName = (process.argv[2] || 'strong').replace(/^--?/, '');
const scenario = scenarioName === 'custom' ? loadCustom() : SCENARIOS[scenarioName];
if (!scenario) {
  console.error(`Unknown scenario "${scenarioName}". Choose: ${[...Object.keys(SCENARIOS), 'custom'].join(', ')}`);
  process.exit(1);
}

const colors = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
};
const c = (k, s) => `${colors[k]}${s}${colors.reset}`;

async function main() {
  console.log(c('bold', `\n=== Dry-run scenario: ${scenarioName} ===\n`));

  // Stage 1: extract & pair
  process.stdout.write(c('cyan', '[1/4] Extract & pair questions... '));
  const t0 = Date.now();
  const parsed = await chatJson(EXTRACT_AND_PAIR_SYSTEM, [
    'QUESTION_PAPER:', scenario.questionPaper, '',
    'ANSWER_KEY:', scenario.answerKey, '',
    'STUDENT_ANSWER:', scenario.studentAnswer,
  ].join('\n'), { maxTokens: 3500, temperature: 0.1 });
  const questions = (parsed?.questions || []).map((q, i) => ({
    question_no: String(q.question_no || `Q${i + 1}`).trim(),
    question_text: clampLen(q.question_text || '', 1500),
    model_answer: clampLen(q.model_answer || '', 1500),
    max_marks: Math.max(1, Math.round(safeNumber(q.max_marks, 5))),
    topic: clampLen(q.topic || 'general', 120),
    key_concepts: safeStrArr(q.key_concepts),
    student_answer: clampLen(q.student_answer || '', 1500),
    student_answer_present: q.student_answer_present !== false && Boolean(String(q.student_answer || '').trim()),
    alignment_confidence: Math.max(0, Math.min(1, safeNumber(q.alignment_confidence, 0.7))),
  }));
  console.log(c('green', `${questions.length} questions in ${((Date.now() - t0) / 1000).toFixed(1)}s`));

  // Stage 2: batch embeddings
  process.stdout.write(c('cyan', '[2/4] Batch embeddings... '));
  const t1 = Date.now();
  const texts = [];
  for (const q of questions) {
    texts.push(q.model_answer || q.question_text || q.topic);
    texts.push(q.student_answer || '(blank)');
    texts.push(q.question_text || q.topic);
  }
  let embeddings = [];
  try {
    embeddings = await embedBatch(texts);
    console.log(c('green', `${embeddings.length} vectors (dim=${embeddings[0]?.length || 0}) in ${((Date.now() - t1) / 1000).toFixed(1)}s`));
  } catch (e) {
    console.log(c('yellow', `failed (${e.message}) — continuing with similarity=0`));
    embeddings = texts.map(() => []);
  }

  // Stage 3: per-question grading (sequential here for clearer logging)
  console.log(c('cyan', '[3/4] Per-question grading...'));
  const judgments = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const lang = detectScript(q.student_answer);
    const similarity = cosine(embeddings[i * 3 + 1] || [], embeddings[i * 3] || []);
    const questionSimilarity = cosine(embeddings[i * 3 + 1] || [], embeddings[i * 3 + 2] || []);
    process.stdout.write(c('dim', `   - ${q.question_no} (lang=${lang}, sim=${similarity.toFixed(2)})... `));
    if (!q.student_answer_present) {
      console.log(c('yellow', 'not attempted (skipped LLM)'));
      judgments.push({ q, similarity, questionSimilarity, lang, judgment: { score: 0, key_concepts_present: [], missed_concepts: q.key_concepts, factual_errors: [], structural_issues: [], improvement_areas: ['Attempt the question.'], suggested_format: '', exemplar_answer: q.model_answer, subtopic: q.topic, bloom_level: 'Remember', confidence: 1, reasoning: 'Question not attempted.' }, calibration: { finalScore: 0, needsReview: false, reasons: ['not attempted'] } });
      continue;
    }
    const tj = Date.now();
    const judgmentRaw = await chatJson(JUDGE_SYSTEM, judgeUserPrompt(q, lang), { maxTokens: 2400, temperature: 0.2 });
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
    const modelLang = detectScript(q.model_answer || q.question_text);
    const calibration = calibrate({
      llmScore: judgment.score, maxMarks: q.max_marks,
      similarity, questionSimilarity, confidence: judgment.confidence,
      crossLingual: lang !== modelLang && lang !== 'unknown' && modelLang !== 'unknown',
    });
    console.log(c('green', `${calibration.finalScore}/${q.max_marks} in ${((Date.now() - tj) / 1000).toFixed(1)}s`));
    judgments.push({ q, similarity, questionSimilarity, lang, judgment, calibration });
  }

  // Stage 4: improvement plan
  process.stdout.write(c('cyan', '[4/4] Improvement plan synthesis... '));
  const t3 = Date.now();
  const planUserPrompt = [
    `TEST: ${scenarioName}`,
    `TOTAL: ${judgments.reduce((a, j) => a + j.calibration.finalScore, 0)}/${judgments.reduce((a, j) => a + j.q.max_marks, 0)}`,
    '',
    'PER-QUESTION SUMMARY:',
    ...judgments.map((j) => `- ${j.q.question_no} (${j.q.topic}): ${j.calibration.finalScore}/${j.q.max_marks} | got: ${j.judgment.key_concepts_present.slice(0, 4).join('; ') || 'none'} | missed: ${j.judgment.missed_concepts.slice(0, 4).join('; ') || 'none'}`),
  ].join('\n');
  let plan = null;
  try {
    plan = await chatJson(PLAN_SYSTEM, planUserPrompt, { maxTokens: 2400, temperature: 0.4 });
    console.log(c('green', `done in ${((Date.now() - t3) / 1000).toFixed(1)}s`));
  } catch (e) {
    console.log(c('yellow', `failed (${e.message})`));
  }

  // ── pretty print ────────────────────────────────────────────────────────
  console.log(c('bold', '\n──────────────── RESULTS ────────────────'));
  for (const { q, judgment, calibration, similarity, questionSimilarity, lang } of judgments) {
    const ratio = q.max_marks ? calibration.finalScore / q.max_marks : 0;
    const tone = ratio >= 0.8 ? 'green' : ratio >= 0.5 ? 'yellow' : 'red';
    console.log('');
    console.log(c('bold', `${q.question_no}`) + c(tone, `   ${calibration.finalScore} / ${q.max_marks}`) + c('dim', `   sim=${similarity.toFixed(2)}  qsim=${questionSimilarity.toFixed(2)}  conf=${judgment.confidence.toFixed(2)}  lang=${lang}  bloom=${judgment.bloom_level}`));
    console.log(c('dim', `Topic: ${q.topic}${judgment.subtopic && judgment.subtopic !== q.topic ? ' · ' + judgment.subtopic : ''}`));
    if (q.question_text) console.log(c('dim', `Question: ${q.question_text.slice(0, 200)}${q.question_text.length > 200 ? '…' : ''}`));
    console.log(c('magenta', `Reasoning: ${judgment.reasoning}`));
    if (calibration.needsReview) console.log(c('yellow', `⚠ needs_review: ${calibration.reasons.join('; ')}`));
    if (judgment.key_concepts_present.length) console.log(c('green', `✓ Got: ${judgment.key_concepts_present.join(', ')}`));
    if (judgment.missed_concepts.length)       console.log(c('red',   `✗ Missed: ${judgment.missed_concepts.join(', ')}`));
    if (judgment.factual_errors.length)        console.log(c('yellow', `! Factual errors: ${judgment.factual_errors.join(', ')}`));
    if (judgment.structural_issues.length)     console.log(c('yellow', `! Structure: ${judgment.structural_issues.join(', ')}`));
    if (judgment.improvement_areas.length)     console.log(c('blue', `→ Focus on: ${judgment.improvement_areas.join(', ')}`));
    if (judgment.suggested_format) {
      console.log(c('cyan', 'Suggested format:'));
      console.log('  ' + judgment.suggested_format.split('\n').join('\n  '));
    }
    if (judgment.exemplar_answer) {
      console.log(c('cyan', 'Exemplar full-marks answer:'));
      console.log('  ' + judgment.exemplar_answer.split('\n').join('\n  '));
    }
  }

  const totalScore = judgments.reduce((a, j) => a + j.calibration.finalScore, 0);
  const totalMax = judgments.reduce((a, j) => a + j.q.max_marks, 0) || 1;
  console.log(c('bold', `\n──────────────── TOTAL: ${totalScore} / ${totalMax}  (${Math.round((totalScore / totalMax) * 100)}%) ────────────────`));

  if (plan) {
    console.log(c('bold', '\n──────────────── IMPROVEMENT PLAN ────────────────'));
    console.log(c('cyan', '\nNarrative:'));
    console.log('  ' + (plan.plan_text || '').split('\n').join('\n  '));
    if (plan.weak_topics?.length) console.log(c('yellow', `\nWeak topics: ${plan.weak_topics.join(', ')}`));
    if (plan.topic_breakdown?.length) {
      console.log(c('cyan', '\nTopic mastery:'));
      for (const t of plan.topic_breakdown) {
        const pct = Math.round((Number(t.mastery) || 0) * 100);
        console.log(`  · ${t.topic}: ${pct}%${t.focus ? ' — ' + t.focus : ''}`);
        if (t.missed?.length) console.log(c('dim', `      missed: ${t.missed.join(', ')}`));
      }
    }
    if (plan.tasks?.length) {
      console.log(c('cyan', '\nNext study tasks:'));
      for (const task of plan.tasks) {
        if (typeof task === 'string') {
          console.log(`  · ${task}`);
        } else {
          console.log(`  · ${task.title}${task.est_minutes ? c('dim', ` (${task.est_minutes} min)`) : ''}`);
          if (task.why) console.log(c('dim', `    why: ${task.why}`));
          if (task.how) console.log(`    ${task.how}`);
        }
      }
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error(c('red', '\n[script error] ') + (err.stack || err.message || err));
  process.exit(1);
});
