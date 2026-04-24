import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SARVAM_FALLBACK_KEY = "sk_tzd0upbj_2CQ3PxfNtBXvKt4AsO7DXGAY";

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const env = (k: string) => String(Deno.env.get(k) || "").trim();
const clean = (v: string) => String(v || "").replace(/\u0000/g, "").trim();

function segmentAnswers(text: string) {
  const cleaned = clean(text);
  if (!cleaned) return ["No readable OCR text extracted."];
  const byQ = cleaned
    .split(/\n(?=\s*(?:q(?:uestion)?\s*\d+|[1-9]\d*\s*[.)-]))/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byQ.length >= 2) return byQ.slice(0, 5);
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const size = Math.max(1, Math.ceil(parts.length / 4));
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += size) out.push(parts.slice(i, i + size).join(" "));
  return out.slice(0, 5);
}

async function ocrViaSarvam(apiKey: string, text: string) {
  const endpoint = env("SARVAM_OCR_URL") || "https://api.sarvam.ai/v1/ocr/text";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-subscription-key": apiKey },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return clean(text);
  const body = await res.json();
  return clean(String(body?.text || body?.data?.text || body?.result?.text || text));
}

async function uploadArtifact(svc: ReturnType<typeof createClient>, bucket: string, schoolId: string, jobId: string, name: string, data: unknown) {
  const path = `ai-artifacts/${schoolId}/${jobId}-${name}.json`;
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
  const { error } = await svc.storage.from(bucket).upload(path, bytes, { upsert: true, contentType: "application/json" });
  if (error) throw error;
  return path;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(500, { error: "Missing function env." });

  const svc = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = (await req.json()) as { jobId?: string };
  const jobId = String(body?.jobId || "").trim();
  if (!jobId) return json(400, { error: "jobId is required." });

  const { data: job, error: jobErr } = await svc
    .from("grading_jobs")
    .select("id, submission_id, attempts")
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr) return json(500, { error: jobErr.message });
  if (!job) return json(404, { error: "Job not found." });

  const { data: sub, error: subErr } = await svc
    .from("answer_submissions")
    .select("id, school_id, test_id, student_id, storage_bucket, answer_key_path, student_answer_path")
    .eq("id", job.submission_id)
    .maybeSingle();
  if (subErr) return json(500, { error: subErr.message });
  if (!sub) return json(404, { error: "Submission not found." });

  try {
    await svc.from("grading_jobs").update({ status: "ocr", attempts: Number(job.attempts || 0) + 1, started_at: new Date().toISOString(), updated_at: new Date().toISOString(), error_message: null, error_details: null }).eq("id", job.id);
    await svc.from("answer_submissions").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", sub.id);

    const bucket = sub.storage_bucket || "answer-sheets";
    const [keyFile, ansFile] = await Promise.all([
      svc.storage.from(bucket).download(sub.answer_key_path || ""),
      svc.storage.from(bucket).download(sub.student_answer_path || ""),
    ]);
    const keyRaw = keyFile.error || !keyFile.data ? "" : clean(await keyFile.data.text());
    const ansRaw = ansFile.error || !ansFile.data ? "" : clean(await ansFile.data.text());

    const sarvamKey = env("SARVAM_API_SUBSCRIPTION_KEY") || SARVAM_FALLBACK_KEY;
    const [keyText, studentText] = await Promise.all([
      ocrViaSarvam(sarvamKey, keyRaw),
      ocrViaSarvam(sarvamKey, ansRaw),
    ]);

    await svc.from("grading_jobs").update({ status: "grading", updated_at: new Date().toISOString() }).eq("id", job.id);

    const keyWords = keyText.toLowerCase().split(/\s+/).filter(Boolean);
    const keySet = new Set(keyWords);
    const segments = segmentAnswers(studentText);
    const maxPerQ = Math.round(100 / Math.max(1, segments.length));

    const questionScores = segments.map((seg, i) => {
      const words = seg.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = words.filter((w) => keySet.has(w)).length;
      const ratio = words.length ? hits / words.length : 0.4;
      const score = Math.max(0, Math.min(maxPerQ, Math.round(((ratio * 0.7) + 0.3) * maxPerQ)));
      const weak = score < Math.round(maxPerQ * 0.6);
      return {
        question_no: `Q${i + 1}`,
        max_score: maxPerQ,
        score,
        confidence: Number((0.55 + Math.min(0.4, ratio * 0.4)).toFixed(2)),
        extracted_answer: seg.slice(0, 1000),
        evaluator_reasoning: weak ? "Lower overlap with expected key points." : "Good overlap with expected key points.",
        strengths: weak ? ["Partial key coverage"] : ["Good keyword coverage", "Readable structure"],
        weaknesses: weak ? ["Missing important key points", "Needs better structure"] : ["Can improve precision"],
      };
    });

    const obtained = questionScores.reduce((a, q) => a + q.score, 0);
    const percentage = Math.round((obtained / 100) * 100);

    const { data: result, error: resultErr } = await svc
      .from("results")
      .upsert({ student_id: sub.student_id, test_id: sub.test_id, marks: obtained, percentage }, { onConflict: "student_id,test_id" })
      .select("id")
      .single();
    if (resultErr) throw resultErr;

    await svc.from("question_scores").delete().eq("result_id", result.id);
    const insertRows = questionScores.map((q) => ({ ...q, result_id: result.id, submission_id: sub.id, test_id: sub.test_id, student_id: sub.student_id, rubric: {} }));
    const { error: qErr } = await svc.from("question_scores").insert(insertRows);
    if (qErr) throw qErr;

    const weakTopics = ["Concept accuracy", "Answer structure", "Keyword coverage"].filter((_, idx) => (idx === 0 ? percentage < 75 : idx === 1 ? percentage < 80 : percentage < 70));
    const tasks = [
      `Rewrite 2 low-score answers daily with bullet-point structure (${weakTopics[0] || "accuracy"} focus).`,
      "Prepare a keyword revision sheet from answer key and revise before next test.",
      "Do one timed practice and self-check with key points.",
      "Discuss recurring weak areas with teacher for targeted practice.",
    ];
    const planText = `OCR extracted student and key text, then evaluated ${questionScores.length} responses question-wise. Focus areas: ${weakTopics.join(", ") || "maintain current performance"}.`;

    await svc.from("student_improvement_plans").upsert({
      student_id: sub.student_id,
      test_id: sub.test_id,
      result_id: result.id,
      submission_id: sub.id,
      plan_text: planText,
      weak_topics: weakTopics,
      tasks,
      model_version: "sarvam-ocr-heuristic-v3",
      generated_by: "sarvam-ocr-heuristic",
      generated_at: new Date().toISOString(),
    }, { onConflict: "student_id,test_id,result_id" });

    await svc.from("grading_jobs").update({ status: "plan", updated_at: new Date().toISOString() }).eq("id", job.id);

    const ocrPath = await uploadArtifact(svc, bucket, sub.school_id, job.id, "ocr", { provider: "sarvam", keyText, studentText, generatedAt: new Date().toISOString() });
    const llmPath = await uploadArtifact(svc, bucket, sub.school_id, job.id, "llm", { output: { obtainedMarks: obtained, percentage, questionScores, weakTopics, tasks, planText }, generatedAt: new Date().toISOString() });

    await svc.from("grading_jobs").update({ status: "done", result_id: result.id, raw_ocr_path: ocrPath, raw_llm_path: llmPath, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
    await svc.from("answer_submissions").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", sub.id);

    return json(200, { success: true, jobId: job.id, resultId: result.id, marks: obtained, percentage, generatedBy: "sarvam-ocr-heuristic" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await svc.from("grading_jobs").update({ status: "failed", error_message: message.slice(0, 500), error_details: { message }, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
    await svc.from("answer_submissions").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", sub.id);
    return json(500, { error: message });
  }
});

