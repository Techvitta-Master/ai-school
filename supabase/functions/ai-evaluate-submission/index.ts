import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  CHAT_MODEL,
  EMBED_DIM,
  EMBED_MODEL,
  TokenUsage,
  addUsage,
  chatJson,
  cosine,
  detectScript,
  embedBatch,
  ocrText,
  pgVectorLiteral,
} from "./_lib/sarvam.ts";
import {
  EXTRACT_AND_PAIR_SYSTEM,
  JUDGE_SYSTEM,
  Judgment,
  Language,
  PLAN_SYSTEM,
  ParsedQuestion,
  PlanOutput,
  extractAndPairUserPrompt,
  judgeUserPrompt,
  planUserPrompt,
} from "./_lib/prompts.ts";
import { calibrate, fallbackEmbeddingScore } from "./_lib/score.ts";
import { buildKnownNames, redactPII } from "./_lib/redact.ts";

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const env = (k: string) => String(Deno.env.get(k) || "").trim();
const nowIso = () => new Date().toISOString();
const clampLen = (s: string, n: number) => (s || "").slice(0, n);

const PARALLEL_JUDGES = 4;
const MAX_INPUT_TOKENS = 50_000;
const APPROX_TOKENS_PER_CHAR = 0.3;

type StageArtifacts = {
  ocr?: string;
  parsed?: string;
  judgments?: string;
  plan?: string;
};

async function uploadArtifact(svc: SupabaseClient, bucket: string, schoolId: string, jobId: string, name: string, data: unknown) {
  const path = `ai-artifacts/${schoolId}/${jobId}-${name}.json`;
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
  const { error } = await svc.storage.from(bucket).upload(path, bytes, { upsert: true, contentType: "application/json" });
  if (error) throw error;
  return path;
}

async function readArtifact<T>(svc: SupabaseClient, bucket: string, path: string | undefined | null): Promise<T | null> {
  if (!path) return null;
  const { data, error } = await svc.storage.from(bucket).download(path);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

async function pLimit<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStringArray(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0).slice(0, max).map((x) => clampLen(String(x), 300));
}

function normalizeQuestionNo(raw: unknown, fallbackIdx: number): string {
  const s = String(raw ?? "").trim();
  if (!s) return `Q${fallbackIdx + 1}`;
  if (/^q?\d+/i.test(s)) return s.toUpperCase().startsWith("Q") ? s : `Q${s.replace(/[).:]+$/, "")}`;
  return s;
}

function approxTokens(text: string): number {
  return Math.ceil((text || "").length * APPROX_TOKENS_PER_CHAR);
}

function normaliseForCompare(s: string): string {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function jaccardWordOverlap(a: string, b: string): number {
  const wa = new Set(normaliseForCompare(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(normaliseForCompare(b).split(" ").filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.min(wa.size, wb.size);
}

function preflightWarnings(args: { questionPaper: string; answerKey: string; studentAnswer: string }): string[] {
  const warnings: string[] = [];
  const trimmedKey = args.answerKey.trim();
  if (!trimmedKey) warnings.push("answer_key_empty");
  const akVsStudent = jaccardWordOverlap(args.answerKey, args.studentAnswer);
  const akVsQp = jaccardWordOverlap(args.answerKey, args.questionPaper);
  // We deliberately do NOT flag "answer_key_same_as_student" — if a teacher uploads
  // the same content for both, the student literally has the model answer and should
  // score 100%. The unrelated check below still catches the original bug (résumé as AK).
  if (trimmedKey && args.questionPaper.trim() && akVsQp < 0.05 && akVsStudent < 0.1) {
    warnings.push("answer_key_unrelated");
  }
  return warnings;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(500, { error: "Missing function env." });

  const svc = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = (await req.json().catch(() => ({}))) as { jobId?: string; sync?: boolean };
  const jobId = String(body?.jobId || "").trim();
  if (!jobId) return json(400, { error: "jobId is required." });

  const work = processJob(svc, jobId);
  if (body?.sync) {
    try {
      const result = await work;
      return json(200, { success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json(500, { error: message });
    }
  }

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work.catch((err) => console.error("[ai-evaluate-submission] background error", err)));
    return json(202, { accepted: true, jobId });
  }
  try {
    const result = await work;
    return json(200, { success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: message });
  }
});

async function processJob(svc: SupabaseClient, jobId: string) {
  const { data: job, error: jobErr } = await svc
    .from("grading_jobs")
    .select("id, submission_id, attempts, stage_artifacts, model_versions, token_usage")
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr) throw jobErr;
  if (!job) throw new Error("Job not found");

  const { data: sub, error: subErr } = await svc
    .from("answer_submissions")
    .select("id, school_id, test_id, student_id, storage_bucket, question_paper_path, answer_key_path, student_answer_path")
    .eq("id", job.submission_id)
    .maybeSingle();
  if (subErr) throw subErr;
  if (!sub) throw new Error("Submission not found");

  const bucket = sub.storage_bucket || "answer-sheets";
  const stageArtifacts: StageArtifacts = (job.stage_artifacts as StageArtifacts) || {};
  let usage: TokenUsage = (job.token_usage as TokenUsage) || {};
  let degraded = false;

  await svc
    .from("grading_jobs")
    .update({
      status: "ocr",
      attempts: Number(job.attempts || 0) + 1,
      started_at: nowIso(),
      updated_at: nowIso(),
      error_message: null,
      error_details: null,
    })
    .eq("id", jobId);
  await svc.from("answer_submissions").update({ status: "processing", updated_at: nowIso() }).eq("id", sub.id);

  const { data: student } = await svc
    .from("students")
    .select("id, name, roll_no")
    .eq("id", sub.student_id)
    .maybeSingle();
  const { data: test } = await svc
    .from("tests")
    .select("id, name, subject_id, subjects:subject_id(name)")
    .eq("id", sub.test_id)
    .maybeSingle();
  const testName = String((test as { name?: string } | null)?.name || "Untitled Test");

  let ocrPayload = await readArtifact<{ questionPaperText: string; answerKeyText: string; studentText: string }>(svc, bucket, stageArtifacts.ocr);
  if (!ocrPayload) {
    const [qpFile, keyFile, ansFile] = await Promise.all([
      sub.question_paper_path ? svc.storage.from(bucket).download(sub.question_paper_path) : Promise.resolve({ data: null, error: null }),
      sub.answer_key_path ? svc.storage.from(bucket).download(sub.answer_key_path) : Promise.resolve({ data: null, error: null }),
      svc.storage.from(bucket).download(sub.student_answer_path || ""),
    ]);
    const qpRaw = qpFile.data ? await qpFile.data.text() : "";
    const keyRaw = keyFile.data ? await keyFile.data.text() : "";
    const ansRaw = ansFile.data ? await ansFile.data.text() : "";
    const [questionPaperText, answerKeyText, studentText] = await Promise.all([
      ocrText(qpRaw),
      ocrText(keyRaw),
      ocrText(ansRaw),
    ]);
    ocrPayload = { questionPaperText, answerKeyText, studentText };
    stageArtifacts.ocr = await uploadArtifact(svc, bucket, sub.school_id, jobId, "ocr", { ...ocrPayload, generatedAt: nowIso() });
    await svc.from("grading_jobs").update({ stage_artifacts: stageArtifacts, updated_at: nowIso() }).eq("id", jobId);
  }

  const knownNames = buildKnownNames(student?.name, student?.roll_no);
  const redactedQp = redactPII(ocrPayload.questionPaperText, knownNames);
  const redactedKey = redactPII(ocrPayload.answerKeyText, knownNames);
  const redactedStudent = redactPII(ocrPayload.studentText, knownNames);

  const totalInputChars = redactedQp.length + redactedKey.length + redactedStudent.length;
  if (approxTokens(redactedQp + redactedKey + redactedStudent) > MAX_INPUT_TOKENS) {
    console.warn(`[ai-evaluate-submission] input ${totalInputChars} chars exceeds budget; truncating`);
  }
  const inputBudget = Math.floor(MAX_INPUT_TOKENS / APPROX_TOKENS_PER_CHAR / 3);
  const trimmedQp = clampLen(redactedQp, inputBudget);
  const trimmedKey = clampLen(redactedKey, inputBudget);
  const trimmedStudent = clampLen(redactedStudent, inputBudget);

  const preWarnings = preflightWarnings({ questionPaper: redactedQp, answerKey: redactedKey, studentAnswer: redactedStudent });
  const noReference = preWarnings.includes("answer_key_empty")
    || preWarnings.includes("answer_key_unrelated")
    || preWarnings.includes("answer_key_same_as_student");
  const answerKeyForExtractor = noReference ? "(not provided — grade without reference)" : trimmedKey;

  await svc.from("grading_jobs").update({ status: "grading", updated_at: nowIso() }).eq("id", jobId);

  let parsedRaw: { questions?: ParsedQuestion[]; input_warnings?: string[] } | null = await readArtifact(svc, bucket, stageArtifacts.parsed);
  if (!parsedRaw?.questions?.length) {
    try {
      const result = await chatJson<{ questions?: ParsedQuestion[]; input_warnings?: string[] }>(
        EXTRACT_AND_PAIR_SYSTEM,
        extractAndPairUserPrompt({ questionPaper: trimmedQp, answerKey: answerKeyForExtractor, studentAnswer: trimmedStudent }),
        { maxTokens: 3500, temperature: 0.1 }
      );
      usage = addUsage(usage, result.usage);
      parsedRaw = { questions: Array.isArray(result.value?.questions) ? result.value.questions : [], input_warnings: result.value?.input_warnings || [] };
    } catch (err) {
      console.warn("[ai-evaluate-submission] extraction failed, falling back to heuristic split", err);
      parsedRaw = { questions: heuristicSegmentation(redactedKey, redactedStudent), input_warnings: [] };
      degraded = true;
    }
    if (!parsedRaw.questions?.length) {
      parsedRaw = { questions: heuristicSegmentation(redactedKey, redactedStudent), input_warnings: [] };
      degraded = true;
    }
    stageArtifacts.parsed = await uploadArtifact(svc, bucket, sub.school_id, jobId, "parsed", { ...parsedRaw, degraded, generatedAt: nowIso() });
    await svc.from("grading_jobs").update({ stage_artifacts: stageArtifacts, updated_at: nowIso() }).eq("id", jobId);
  }
  const parsed: { questions: ParsedQuestion[] } = { questions: parsedRaw.questions || [] };
  const llmWarnings = Array.isArray(parsedRaw.input_warnings) ? parsedRaw.input_warnings.filter((w): w is string => typeof w === "string") : [];
  const allWarnings = Array.from(new Set([...preWarnings, ...llmWarnings]));

  const questions: ParsedQuestion[] = parsed.questions.map((q, idx) => {
    let modelAnswer = clampLen(String(q.model_answer || ""), 1500);
    const studentAns = clampLen(String(q.student_answer || ""), 1500);
    // Only strip model_answer when the answer key was already flagged unusable (noReference).
    // If teacher uploaded matching content for both, that's a legitimate 100% match.
    if (noReference) modelAnswer = "";
    return {
      question_no: normalizeQuestionNo(q.question_no, idx),
      question_text: clampLen(String(q.question_text || ""), 1500),
      model_answer: modelAnswer,
      max_marks: Math.max(1, Math.round(safeNumber(q.max_marks, 5))),
      topic: clampLen(String(q.topic || "general"), 120),
      key_concepts: safeStringArray(q.key_concepts, 8),
      student_answer: studentAns,
      student_answer_present: q.student_answer_present !== false && Boolean(studentAns.trim()),
      alignment_confidence: Math.max(0, Math.min(1, safeNumber(q.alignment_confidence, 0.7))),
    };
  });

  const embedTexts: string[] = [];
  for (const q of questions) {
    embedTexts.push(q.model_answer || q.question_text || q.topic);
    embedTexts.push(q.student_answer || "(blank)");
    embedTexts.push(q.question_text || q.topic);
  }
  let embeddings: number[][] = [];
  try {
    embeddings = await embedBatch(embedTexts);
  } catch (err) {
    console.warn("[ai-evaluate-submission] embedding batch failed", err);
    embeddings = embedTexts.map(() => []);
    degraded = true;
  }

  type RowJudgment = {
    question: ParsedQuestion;
    judgment: Judgment;
    similarity: number;
    questionSimilarity: number;
    finalScore: number;
    needsReview: boolean;
    reasons: string[];
    studentEmbedding: number[];
    modelEmbedding: number[];
    questionEmbedding: number[];
    studentLang: Language;
    modelLang: Language;
    fallback: boolean;
  };

  const rowJudgments: RowJudgment[] = new Array(questions.length);

  await pLimit(questions, PARALLEL_JUDGES, async (q, idx) => {
    const modelEmb = embeddings[idx * 3] || [];
    const studentEmb = embeddings[idx * 3 + 1] || [];
    const questionEmb = embeddings[idx * 3 + 2] || [];
    const similarity = cosine(studentEmb, modelEmb);
    const questionSimilarity = cosine(studentEmb, questionEmb);
    const studentLang = detectScript(q.student_answer);
    const modelLang = detectScript(q.model_answer || q.question_text);
    const crossLingual = studentLang !== modelLang && studentLang !== "unknown" && modelLang !== "unknown";

    if (!q.student_answer_present || !q.student_answer.trim()) {
      rowJudgments[idx] = {
        question: q,
        judgment: {
          score: 0,
          key_concepts_present: [],
          missed_concepts: q.key_concepts,
          factual_errors: [],
          structural_issues: [],
          improvement_areas: ["Attempt the question; even a partial answer earns marks."],
          suggested_format: "Begin with a definition, list the key concepts, support with one example.",
          exemplar_answer: q.model_answer || "",
          subtopic: q.topic,
          bloom_level: "Remember",
          confidence: 1,
          reasoning: "Question not attempted by the student.",
        },
        similarity: 0,
        questionSimilarity,
        finalScore: 0,
        needsReview: false,
        reasons: ["question not attempted"],
        studentEmbedding: studentEmb,
        modelEmbedding: modelEmb,
        questionEmbedding: questionEmb,
        studentLang,
        modelLang,
        fallback: false,
      };
      return;
    }

    let judgment: Judgment;
    let fallback = false;
    try {
      const result = await chatJson<Judgment>(
        JUDGE_SYSTEM,
        judgeUserPrompt({
          questionNo: q.question_no,
          questionText: q.question_text,
          modelAnswer: q.model_answer,
          studentAnswer: q.student_answer,
          maxMarks: q.max_marks,
          topic: q.topic,
          keyConcepts: q.key_concepts,
          language: studentLang,
        }),
        { maxTokens: 2400, temperature: 0.2 }
      );
      usage = addUsage(usage, result.usage);
      judgment = sanitizeJudgment(result.value, q);
    } catch (err) {
      console.warn(`[ai-evaluate-submission] judge failed for ${q.question_no}, falling back to embedding`, err);
      judgment = {
        score: fallbackEmbeddingScore(similarity, q.max_marks),
        key_concepts_present: [],
        missed_concepts: q.key_concepts,
        factual_errors: [],
        structural_issues: ["Automated grading could not analyse this answer in detail."],
        improvement_areas: ["Request a manual review from your teacher."],
        suggested_format: "",
        exemplar_answer: q.model_answer,
        subtopic: q.topic,
        bloom_level: "Understand",
        confidence: 0.4,
        reasoning: `Embedding-only fallback (similarity=${similarity.toFixed(2)}).`,
      };
      fallback = true;
      degraded = true;
    }

    if (noReference) judgment.confidence = Math.min(judgment.confidence, 0.5);
    const cal = calibrate({
      llmScore: judgment.score,
      maxMarks: q.max_marks,
      similarity,
      questionSimilarity,
      confidence: judgment.confidence,
      crossLingual,
    });
    if (noReference && !cal.reasons.includes("graded without reference answer")) {
      cal.reasons.push("graded without reference answer");
      cal.needsReview = true;
    }

    rowJudgments[idx] = {
      question: q,
      judgment,
      similarity,
      questionSimilarity,
      finalScore: cal.finalScore,
      needsReview: cal.needsReview || fallback,
      reasons: fallback ? ["embedding-only fallback", ...cal.reasons] : cal.reasons,
      studentEmbedding: studentEmb,
      modelEmbedding: modelEmb,
      questionEmbedding: questionEmb,
      studentLang,
      modelLang,
      fallback,
    };
  });

  stageArtifacts.judgments = await uploadArtifact(svc, bucket, sub.school_id, jobId, "judgments", {
    rows: rowJudgments.map((r) => ({
      question_no: r.question.question_no,
      score: r.finalScore,
      max_score: r.question.max_marks,
      similarity: r.similarity,
      question_similarity: r.questionSimilarity,
      llm_score: r.judgment.score,
      confidence: r.judgment.confidence,
      needs_review: r.needsReview,
      reasons: r.reasons,
      judgment: r.judgment,
    })),
    generatedAt: nowIso(),
  });
  await svc
    .from("grading_jobs")
    .update({ status: "plan", stage_artifacts: stageArtifacts, updated_at: nowIso() })
    .eq("id", jobId);

  const obtained = rowJudgments.reduce((a, r) => a + r.finalScore, 0);
  const totalMax = rowJudgments.reduce((a, r) => a + r.question.max_marks, 0) || 1;
  const percentage = Math.round((obtained / totalMax) * 100);

  let plan: PlanOutput | null = await readArtifact<PlanOutput>(svc, bucket, stageArtifacts.plan);
  if (!plan) {
    try {
      const result = await chatJson<PlanOutput>(
        PLAN_SYSTEM,
        planUserPrompt({
          testName,
          totalMarks: totalMax,
          obtainedMarks: obtained,
          perQuestion: rowJudgments.map((r) => ({
            question_no: r.question.question_no,
            score: r.finalScore,
            max_score: r.question.max_marks,
            topic: r.question.topic,
            missed: r.judgment.missed_concepts,
            present: r.judgment.key_concepts_present,
            reasoning: r.judgment.reasoning,
          })),
        }),
        { maxTokens: 2400, temperature: 0.4 }
      );
      usage = addUsage(usage, result.usage);
      plan = sanitizePlan(result.value);
    } catch (err) {
      console.warn("[ai-evaluate-submission] plan synthesis failed", err);
      plan = {
        plan_text: `You scored ${obtained}/${totalMax} (${percentage}%) on ${testName}. Review the per-question feedback for the concepts you missed and rewrite the weakest answers using the suggested formats.`,
        weak_topics: Array.from(new Set(rowJudgments.filter((r) => r.finalScore / r.question.max_marks < 0.6).map((r) => r.question.topic).filter(Boolean))).slice(0, 5),
        topic_breakdown: aggregateTopicBreakdown(rowJudgments),
        tasks: [
          { title: "Rewrite low-score answers", why: "Reinforces the missed concepts.", how: "Pick the two lowest-scoring questions and rewrite them following the suggested format.", est_minutes: 30 },
          { title: "Daily concept revision", why: "Builds long-term retention.", how: "Read your notes for the weak topics and summarise each in 5 lines.", est_minutes: 20 },
        ],
      };
      degraded = true;
    }
    stageArtifacts.plan = await uploadArtifact(svc, bucket, sub.school_id, jobId, "plan", { ...plan, generatedAt: nowIso() });
    await svc.from("grading_jobs").update({ stage_artifacts: stageArtifacts, updated_at: nowIso() }).eq("id", jobId);
  }

  const { data: result, error: resultErr } = await svc
    .from("results")
    .upsert(
      { student_id: sub.student_id, test_id: sub.test_id, marks: obtained, percentage },
      { onConflict: "student_id,test_id" }
    )
    .select("id")
    .single();
  if (resultErr) throw resultErr;
  const resultId = result.id as string;

  await svc.from("question_scores").delete().eq("result_id", resultId);

  const insertRows = rowJudgments.map((r) => {
    const j = r.judgment;
    const reasoning = r.reasons.length
      ? `${j.reasoning} (${r.reasons.join("; ")})`
      : j.reasoning;
    return {
      result_id: resultId,
      submission_id: sub.id,
      test_id: sub.test_id,
      student_id: sub.student_id,
      question_no: r.question.question_no,
      max_score: r.question.max_marks,
      score: r.finalScore,
      original_ai_score: r.finalScore,
      llm_score: j.score,
      semantic_similarity: Number(r.similarity.toFixed(4)),
      confidence: Number((j.confidence ?? 0.5).toFixed(2)),
      alignment_confidence: Number(r.question.alignment_confidence.toFixed(2)),
      needs_review: r.needsReview,
      review_reasons: r.reasons,
      extracted_answer: clampLen(r.question.student_answer, 1000),
      evaluator_reasoning: clampLen(reasoning, 800),
      strengths: j.key_concepts_present,
      weaknesses: j.missed_concepts,
      rubric: { rubric_band: rubricBand(r.finalScore, r.question.max_marks) },
      question_text: r.question.question_text,
      model_answer: r.question.model_answer,
      student_answer_present: r.question.student_answer_present,
      topic: r.question.topic,
      subtopic: clampLen(j.subtopic || r.question.topic, 120),
      bloom_level: j.bloom_level || "Understand",
      student_lang: r.studentLang,
      model_lang: r.modelLang,
    };
  });

  const { data: insertedRows, error: qErr } = await svc.from("question_scores").insert(insertRows).select("id, question_no, score");
  if (qErr) throw qErr;

  const idByQuestionNo = new Map<string, string>();
  for (const row of insertedRows || []) idByQuestionNo.set(row.question_no, row.id);

  const feedbackRows = rowJudgments
    .map((r) => {
      const id = idByQuestionNo.get(r.question.question_no);
      if (!id) return null;
      return {
        question_score_id: id,
        key_concepts_present: r.judgment.key_concepts_present,
        missed_concepts: r.judgment.missed_concepts,
        factual_errors: r.judgment.factual_errors,
        structural_issues: r.judgment.structural_issues,
        improvement_areas: r.judgment.improvement_areas,
        suggested_format: clampLen(r.judgment.suggested_format || "", 1500),
        exemplar_answer: clampLen(r.judgment.exemplar_answer || "", 2500),
        student_embedding: pgVectorLiteral(r.studentEmbedding),
        model_embedding: pgVectorLiteral(r.modelEmbedding),
        question_embedding: pgVectorLiteral(r.questionEmbedding),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (feedbackRows.length) {
    const { error: fbErr } = await svc.from("question_feedback").upsert(feedbackRows, { onConflict: "question_score_id" });
    if (fbErr) console.warn("[ai-evaluate-submission] feedback upsert error", fbErr);
  }

  const auditRows = rowJudgments
    .map((r) => {
      const id = idByQuestionNo.get(r.question.question_no);
      if (!id) return null;
      return {
        question_score_id: id,
        result_id: resultId,
        actor_role: "system",
        action: "ai_score" as const,
        before_score: null,
        after_score: r.finalScore,
        reason: r.reasons.length ? r.reasons.join("; ") : "initial AI grading",
        metadata: { llm_score: r.judgment.score, similarity: r.similarity, confidence: r.judgment.confidence, fallback: r.fallback },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (auditRows.length) {
    const { error: auditErr } = await svc.from("grading_audit").insert(auditRows);
    if (auditErr) console.warn("[ai-evaluate-submission] audit insert error", auditErr);
  }

  await svc.from("student_improvement_plans").upsert(
    {
      student_id: sub.student_id,
      test_id: sub.test_id,
      result_id: resultId,
      submission_id: sub.id,
      plan_text: plan.plan_text,
      weak_topics: plan.weak_topics,
      tasks: plan.tasks,
      topic_breakdown: plan.topic_breakdown,
      model_version: `${CHAT_MODEL}+${EMBED_MODEL}`,
      generated_by: degraded ? "sarvam-semantic-degraded" : "sarvam-semantic",
      generated_at: nowIso(),
    },
    { onConflict: "student_id,test_id,result_id" }
  );

  const totalTokens = usage.total_tokens || ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0));
  const costInr = Number((totalTokens * 0.000015).toFixed(4));

  await svc
    .from("grading_jobs")
    .update({
      status: "done",
      result_id: resultId,
      raw_ocr_path: stageArtifacts.ocr || null,
      raw_llm_path: stageArtifacts.judgments || null,
      stage_artifacts: stageArtifacts,
      model_versions: { ocr: "sarvam-ocr", chat: CHAT_MODEL, embed: `${EMBED_MODEL}/${EMBED_DIM}` },
      token_usage: usage,
      cost_estimate_inr: costInr,
      degraded_mode: degraded,
      finished_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", jobId);
  await svc.from("answer_submissions").update({ status: "done", updated_at: nowIso() }).eq("id", sub.id);

  return {
    jobId,
    resultId,
    marks: obtained,
    totalMarks: totalMax,
    percentage,
    questionCount: rowJudgments.length,
    needsReviewCount: rowJudgments.filter((r) => r.needsReview).length,
    degraded,
  };
}

function rubricBand(score: number, max: number): string {
  if (max <= 0) return "unknown";
  const ratio = score / max;
  if (ratio >= 0.95) return "exam-ready";
  if (ratio >= 0.75) return "well-structured-minor-errors";
  if (ratio >= 0.55) return "correct-missing-detail";
  if (ratio >= 0.35) return "partial-major-gap";
  if (ratio >= 0.1) return "key-term-only";
  return "blank-or-irrelevant";
}

function sanitizeJudgment(j: Partial<Judgment>, q: ParsedQuestion): Judgment {
  const score = Math.max(0, Math.min(q.max_marks, safeNumber(j.score, 0)));
  const confidence = Math.max(0, Math.min(1, safeNumber(j.confidence, 0.6)));
  return {
    score,
    key_concepts_present: safeStringArray(j.key_concepts_present),
    missed_concepts: safeStringArray(j.missed_concepts),
    factual_errors: safeStringArray(j.factual_errors),
    structural_issues: safeStringArray(j.structural_issues),
    improvement_areas: safeStringArray(j.improvement_areas),
    suggested_format: clampLen(String(j.suggested_format || ""), 1500),
    exemplar_answer: clampLen(String(j.exemplar_answer || ""), 2500),
    subtopic: clampLen(String(j.subtopic || q.topic), 120),
    bloom_level: String(j.bloom_level || "Understand"),
    confidence,
    reasoning: clampLen(String(j.reasoning || ""), 600),
  };
}

function sanitizePlan(p: Partial<PlanOutput>): PlanOutput {
  const breakdown = Array.isArray(p.topic_breakdown)
    ? p.topic_breakdown.slice(0, 12).map((t) => ({
        topic: clampLen(String(t.topic || "general"), 120),
        mastery: Math.max(0, Math.min(1, safeNumber(t.mastery, 0))),
        missed: safeStringArray(t.missed),
        focus: clampLen(String(t.focus || ""), 400),
      }))
    : [];
  const tasks = Array.isArray(p.tasks)
    ? p.tasks.slice(0, 8).map((t) => ({
        title: clampLen(String(t.title || ""), 120),
        why: clampLen(String(t.why || ""), 300),
        how: clampLen(String(t.how || ""), 600),
        est_minutes: Math.max(5, Math.min(180, Math.round(safeNumber(t.est_minutes, 20)))),
      }))
    : [];
  return {
    plan_text: clampLen(String(p.plan_text || ""), 4000),
    weak_topics: safeStringArray(p.weak_topics, 12),
    topic_breakdown: breakdown,
    tasks,
  };
}

function aggregateTopicBreakdown(rows: Array<{ question: ParsedQuestion; finalScore: number; judgment: Judgment }>): PlanOutput["topic_breakdown"] {
  const map = new Map<string, { score: number; max: number; missed: Set<string> }>();
  for (const r of rows) {
    const key = r.question.topic || "general";
    const entry = map.get(key) || { score: 0, max: 0, missed: new Set<string>() };
    entry.score += r.finalScore;
    entry.max += r.question.max_marks;
    for (const m of r.judgment.missed_concepts) entry.missed.add(m);
    map.set(key, entry);
  }
  return Array.from(map.entries()).map(([topic, v]) => ({
    topic,
    mastery: v.max > 0 ? Number((v.score / v.max).toFixed(2)) : 0,
    missed: Array.from(v.missed).slice(0, 6),
    focus: v.max > 0 && v.score / v.max < 0.6 ? `Revise ${topic} fundamentals before the next test.` : `Maintain practice on ${topic}.`,
  }));
}

function heuristicSegmentation(keyText: string, studentText: string): ParsedQuestion[] {
  const split = (text: string) =>
    text
      .split(/\n(?=\s*(?:q(?:uestion)?\s*\d+|[1-9]\d*\s*[.)-]))/gi)
      .map((s) => s.trim())
      .filter(Boolean);
  const keys = split(keyText);
  const studs = split(studentText);
  const count = Math.max(1, Math.min(8, Math.max(keys.length, studs.length, 1)));
  const out: ParsedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const model = (keys[i] || "").slice(0, 1500);
    const student = (studs[i] || "").slice(0, 1500);
    out.push({
      question_no: `Q${i + 1}`,
      question_text: "",
      model_answer: model,
      max_marks: 5,
      topic: "general",
      key_concepts: [],
      student_answer: student,
      student_answer_present: Boolean(student.trim()),
      alignment_confidence: 0.4,
    });
  }
  return out;
}
