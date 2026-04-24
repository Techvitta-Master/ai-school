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

export async function listQuestionScoresForResult(supabase, resultId) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('question_scores')
    .select(
      'id, question_no, max_score, score, confidence, extracted_answer, evaluator_reasoning, strengths, weaknesses, created_at'
    )
    .eq('result_id', resultId)
    .order('question_no', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getImprovementPlanForResult(supabase, resultId) {
  requireSupabase(supabase);
  const { data, error } = await supabase
    .from('student_improvement_plans')
    .select('id, plan_text, weak_topics, tasks, model_version, generated_by, generated_at')
    .eq('result_id', resultId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
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
