function requireSupabase(supabase) {
  if (!supabase) throw new Error('Supabase is not configured.');
}

export async function createAnswerSubmission(supabase, payload) {
  requireSupabase(supabase);
  const row = {
    school_id: payload.schoolId,
    class_id: payload.classId,
    test_id: payload.testId,
    student_id: payload.studentId,
    uploaded_by_teacher_id: payload.uploadedByTeacherId || null,
    storage_bucket: payload.storageBucket || 'answer-sheets',
    question_paper_path: payload.questionPaperPath || '',
    answer_key_path: payload.answerKeyPath || '',
    student_answer_path: payload.studentAnswerPath,
    mime_type: payload.mimeType || null,
    status: payload.status || 'uploaded',
    metadata: payload.metadata || {},
  };
  const { data, error } = await supabase
    .from('answer_submissions')
    .insert(row)
    .select(
      'id, school_id, class_id, test_id, student_id, uploaded_by_teacher_id, storage_bucket, question_paper_path, answer_key_path, student_answer_path, status, submitted_at'
    )
    .single();
  if (error) throw error;
  return data;
}

export async function createGradingJob(supabase, payload) {
  requireSupabase(supabase);
  const row = {
    submission_id: payload.submissionId,
    school_id: payload.schoolId,
    status: payload.status || 'queued',
    attempts: 0,
    idempotency_key: payload.idempotencyKey,
    model_config: payload.modelConfig || {},
    created_by: payload.createdBy || null,
  };
  const { data, error } = await supabase
    .from('grading_jobs')
    .insert(row)
    .select('id, submission_id, school_id, status, attempts, idempotency_key, model_config, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getGradingJobById(supabase, jobId) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('grading_jobs')
    .select(
      `
      id,
      submission_id,
      school_id,
      status,
      attempts,
      error_message,
      error_details,
      raw_ocr_path,
      raw_llm_path,
      result_id,
      started_at,
      finished_at,
      created_at,
      answer_submissions (
        id,
        test_id,
        student_id,
        submitted_at
      )
    `
    )
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function listGradingJobsByTeacher(supabase, teacherId, { limit = 20 } = {}) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('grading_jobs')
    .select(
      `
      id,
      status,
      attempts,
      error_message,
      result_id,
      created_at,
      finished_at,
      answer_submissions!inner (
        id,
        test_id,
        student_id,
        uploaded_by_teacher_id
      )
    `
    )
    .eq('answer_submissions.uploaded_by_teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

const QUESTION_SCORE_FIELDS = [
  'id',
  'question_no',
  'max_score',
  'score',
  'original_ai_score',
  'teacher_override_score',
  'override_reason',
  'overridden_by',
  'overridden_at',
  'llm_score',
  'semantic_similarity',
  'confidence',
  'alignment_confidence',
  'needs_review',
  'review_reasons',
  'extracted_answer',
  'evaluator_reasoning',
  'strengths',
  'weaknesses',
  'rubric',
  'question_text',
  'model_answer',
  'student_answer_present',
  'topic',
  'subtopic',
  'bloom_level',
  'student_lang',
  'model_lang',
  'created_at',
].join(', ');

export async function listQuestionScoresForResult(supabase, resultId) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('question_scores')
    .select(QUESTION_SCORE_FIELDS)
    .eq('result_id', resultId)
    .order('question_no', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listQuestionFeedbackForResult(supabase, resultId) {
  requireSupabase(supabase);
  const { data: scoreRows, error: scoreErr } = await supabase
    .from('question_scores')
    .select('id, question_no')
    .eq('result_id', resultId);
  if (scoreErr) throw scoreErr;
  const scoreIds = (scoreRows || []).map((r) => r.id);
  if (!scoreIds.length) return {};
  const { data: feedbackRows, error: fbErr } = await supabase
    .from('question_feedback')
    .select(
      'question_score_id, key_concepts_present, missed_concepts, factual_errors, structural_issues, improvement_areas, suggested_format, exemplar_answer'
    )
    .in('question_score_id', scoreIds);
  if (fbErr) throw fbErr;
  const byId = {};
  for (const row of feedbackRows || []) byId[row.question_score_id] = row;
  return byId;
}

export async function getImprovementPlanForResult(supabase, resultId) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('student_improvement_plans')
    .select('id, plan_text, weak_topics, tasks, topic_breakdown, model_version, generated_by, generated_at')
    .eq('result_id', resultId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getResultById(supabase, resultId) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('results')
    .select('id, student_id, test_id, marks, percentage, created_at')
    .eq('id', resultId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function fetchEvaluationDetail(supabase, resultId) {
  requireSupabase(supabase);
  const [result, scores, feedbackById, plan] = await Promise.all([
    getResultById(supabase, resultId),
    listQuestionScoresForResult(supabase, resultId),
    listQuestionFeedbackForResult(supabase, resultId),
    getImprovementPlanForResult(supabase, resultId),
  ]);
  const merged = (scores || []).map((s) => ({ ...s, feedback: feedbackById[s.id] || null }));
  return { result, questions: merged, plan };
}

export async function overrideQuestionScore(supabase, questionScoreId, { newScore, reason, actorId }) {
  requireSupabase(supabase);
  if (!questionScoreId) throw new Error('questionScoreId is required');
  if (typeof newScore !== 'number' || Number.isNaN(newScore)) throw new Error('newScore must be a number');
  if (!reason || !reason.trim()) throw new Error('reason is required for an override');

  const { data: current, error: currErr } = await supabase
    .from('question_scores')
    .select('id, result_id, score, max_score, original_ai_score, test_id, student_id')
    .eq('id', questionScoreId)
    .maybeSingle();
  if (currErr) throw currErr;
  if (!current) throw new Error('question score not found');

  const clamped = Math.max(0, Math.min(Number(current.max_score), newScore));
  const original = current.original_ai_score ?? current.score;
  const nowIso = new Date().toISOString();

  const { data: updated, error: updErr } = await supabase
    .from('question_scores')
    .update({
      score: clamped,
      teacher_override_score: clamped,
      override_reason: reason,
      overridden_by: actorId || null,
      overridden_at: nowIso,
      original_ai_score: original,
      needs_review: false,
    })
    .eq('id', questionScoreId)
    .select(QUESTION_SCORE_FIELDS)
    .single();
  if (updErr) throw updErr;

  await supabase.from('grading_audit').insert({
    question_score_id: questionScoreId,
    result_id: current.result_id,
    actor_id: actorId || null,
    actor_role: 'teacher',
    action: 'override',
    before_score: current.score,
    after_score: clamped,
    reason,
    metadata: { source: 'workbench-override' },
  });

  await recalculateResultTotal(supabase, current.result_id);
  return updated;
}

async function recalculateResultTotal(supabase, resultId) {
  const { data: rows, error } = await supabase
    .from('question_scores')
    .select('score, max_score')
    .eq('result_id', resultId);
  if (error) throw error;
  const obtained = (rows || []).reduce((a, r) => a + Number(r.score || 0), 0);
  const totalMax = (rows || []).reduce((a, r) => a + Number(r.max_score || 0), 0) || 1;
  const percentage = Math.round((obtained / totalMax) * 100);
  await supabase
    .from('results')
    .update({ marks: obtained, percentage })
    .eq('id', resultId);
  return { marks: obtained, percentage };
}

export async function listGradingAuditForResult(supabase, resultId) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('grading_audit')
    .select('id, question_score_id, action, before_score, after_score, reason, actor_id, actor_role, metadata, created_at')
    .eq('result_id', resultId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listReviewQueueForTeacher(supabase, teacherId, { limit = 50 } = {}) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('question_scores')
    .select(
      `id, question_no, score, max_score, needs_review, review_reasons, topic, evaluator_reasoning, created_at,
       answer_submissions:submission_id ( id, uploaded_by_teacher_id, test_id, student_id )`
    )
    .eq('needs_review', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).filter((row) => row.answer_submissions?.uploaded_by_teacher_id === teacherId);
}

export async function requestRegrade(supabase, submissionId, { actorId, parentJobId, idempotencyKey } = {}) {
  requireSupabase(supabase);
  const { data: submission, error: subErr } = await supabase
    .from('answer_submissions')
    .select('id, school_id, regrade_count')
    .eq('id', submissionId)
    .maybeSingle();
  if (subErr) throw subErr;
  if (!submission) throw new Error('submission not found');

  const newRegradeCount = Number(submission.regrade_count || 0) + 1;
  const key = idempotencyKey || `regrade-${submissionId}-${newRegradeCount}-${Date.now()}`;

  const { data: job, error: jobErr } = await supabase
    .from('grading_jobs')
    .insert({
      submission_id: submissionId,
      school_id: submission.school_id,
      status: 'queued',
      attempts: 0,
      idempotency_key: key,
      model_config: { trigger: 'regrade', requested_by: actorId || null },
      parent_grading_job_id: parentJobId || null,
      created_by: actorId || null,
    })
    .select('id, submission_id, status, created_at, parent_grading_job_id')
    .single();
  if (jobErr) throw jobErr;

  await supabase
    .from('answer_submissions')
    .update({ status: 'queued', regrade_count: newRegradeCount, updated_at: new Date().toISOString() })
    .eq('id', submissionId);

  return job;
}

export async function invokeAIEvaluationJob(supabase, jobId) {
  requireSupabase(supabase);
  const { data, error } = await supabase.functions.invoke('ai-evaluate-submission', {
    body: { jobId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
