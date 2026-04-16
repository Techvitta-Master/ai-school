/**
 * evaluationService.js
 * Dummy evaluation engine — does NOT call any AI API.
 * Produces a full RCA-shaped result (per-question scores, topic analysis,
 * improvement plan) that is forward-compatible with a real OCR+LLM evaluator.
 *
 * Results are written to:
 *   • `scores`      — score, grade, feedback, topic_scores (backward-compat)
 *   • `evaluations` — full details jsonb (requires migration 019)
 *   • `answer_sheets.status` — set to 'evaluated'
 */
import { supabase } from './supabaseClient';

// ─── Templates ────────────────────────────────────────────────────────────────

const GRADE_FEEDBACK = {
  'A+': [
    'Outstanding performance! You have mastered the material. Keep challenging yourself with advanced problems.',
    'Excellent work. Your understanding is thorough and well-applied across all topics.',
  ],
  A: [
    'Great performance. A few more practice tests will take you to the top.',
    'Strong work overall. Focus on edge cases to reach excellence.',
  ],
  'B+': [
    'Good job! Solid foundation in place. Strengthen the weak areas identified below for a significant jump.',
    'Consistent effort is paying off. Target the highlighted weak topics.',
  ],
  B: [
    'Decent attempt. Review the identified topics and practise more application-level questions.',
    'You understand the basics. Push deeper into the concepts that need more work.',
  ],
  C: [
    'Fair attempt. Revisit the fundamentals and do daily practice exercises on the weak topics.',
    'Some gaps in understanding. Focus on one weak topic at a time and build up.',
  ],
  D: [
    'Significant improvement needed. Start with the basics and build up systematically.',
    'Consult your teacher for guided revision on the key concepts listed below.',
  ],
};

const QUESTION_REMARKS = {
  excellent: [
    'Excellent — full marks deserved.',
    'Clear and well-articulated answer.',
    'Precise and accurate response.',
  ],
  good: [
    'Good understanding, minor errors.',
    'Mostly correct — review the small gaps.',
    'Solid attempt.',
  ],
  average: [
    'Partial understanding shown — revisit this concept.',
    'Key points are missing.',
    'Review from the textbook and reattempt.',
  ],
  poor: [
    'Fundamental concept not fully understood.',
    'Needs significant revision — revisit from basics.',
    'Confused with a related concept; compare them side-by-side.',
  ],
};

const IMPROVEMENT_TEMPLATES = [
  (t) => `Re-read your textbook section on "${t}" and make concise revision notes.`,
  (t) => `Attempt 10 practice questions daily on "${t}" until confident.`,
  (t) => `Discuss "${t}" with your teacher and ask for worked examples.`,
  (t) => `Watch a short video explanation on "${t}" to reinforce understanding.`,
  () => 'Take a full timed mock test after completing topic-wise revision.',
];

const STRONG_REASONS = [
  'Clear understanding demonstrated.',
  'Well-structured answer with good examples.',
  'Strong conceptual grasp shown.',
  'Precise and accurate throughout.',
];

const WEAK_REASONS = [
  'Key definitions missing or confused.',
  'Application of the concept to the question was incorrect.',
  'Fundamental concept not fully understood.',
  'Confused with a related concept — review side-by-side.',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function deriveGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

// ─── Core dummy RCA builder ───────────────────────────────────────────────────

/**
 * Builds a full RCA evaluation result with no DB interaction.
 * Exported for unit testing.
 *
 * @param {string[]} topics       Topics from the test syllabus.
 * @param {number}   totalMarks   Max marks for the test (default 100).
 * @returns RCA-shaped evaluation object.
 */
export function buildEvaluation(topics = [], totalMarks = 100) {
  const NUM_QUESTIONS = 5;
  const effectiveTopics = topics.length > 0 ? topics : ['General'];

  // Overall marks: random 55–95
  const marks = Math.floor(Math.random() * 41) + 55;
  const grade = deriveGrade(marks);

  // Per-question scoring
  const maxPerQ = Math.floor(totalMarks / NUM_QUESTIONS);

  const perQuestionScores = Array.from({ length: NUM_QUESTIONS }, (_, i) => {
    const topic = effectiveTopics[i % effectiveTopics.length];
    const max = maxPerQ;

    // Bias scored around the overall percentage with ±15% variance
    const bias = (marks / 100) * max;
    const variance = max * 0.15;
    const scored = Math.min(
      max,
      Math.max(0, Math.round(bias + (Math.random() - 0.5) * 2 * variance))
    );

    const ratio = scored / max;
    let remark;
    if (ratio >= 0.85) remark = pick(QUESTION_REMARKS.excellent);
    else if (ratio >= 0.65) remark = pick(QUESTION_REMARKS.good);
    else if (ratio >= 0.45) remark = pick(QUESTION_REMARKS.average);
    else remark = pick(QUESTION_REMARKS.poor);

    return { q: `Q${i + 1}`, topic, max, scored, remark };
  });

  // Aggregate per-topic
  const topicMap = {};
  perQuestionScores.forEach(({ topic, max, scored }) => {
    if (!topicMap[topic]) topicMap[topic] = { totalMax: 0, totalScored: 0 };
    topicMap[topic].totalMax += max;
    topicMap[topic].totalScored += scored;
  });

  const topicRCA = { weak: [], strong: [] };
  Object.entries(topicMap).forEach(([topic, { totalMax, totalScored }]) => {
    const pct = Math.round((totalScored / totalMax) * 100);
    if (pct < 60) {
      topicRCA.weak.push({ topic, score: pct, reason: pick(WEAK_REASONS) });
    } else if (pct >= 80) {
      topicRCA.strong.push({ topic, score: pct, reason: pick(STRONG_REASONS) });
    }
  });

  // Flat topic→score map kept for backward compat with scores.topic_scores
  const topicScores = Object.fromEntries(
    Object.entries(topicMap).map(([topic, { totalMax, totalScored }]) => [
      topic,
      Math.round((totalScored / totalMax) * 100),
    ])
  );

  // Improvement plan referencing weak topics (fall back to all topics if none are weak)
  const planTargets = topicRCA.weak.map((w) => w.topic);
  const fallback = effectiveTopics.slice(0, 2);
  const improvementPlan = [
    IMPROVEMENT_TEMPLATES[0](planTargets[0] || fallback[0] || 'this topic'),
    IMPROVEMENT_TEMPLATES[1](planTargets[1] || planTargets[0] || fallback[1] || fallback[0] || 'weak topics'),
    IMPROVEMENT_TEMPLATES[4](),
  ];

  const feedbackPool = GRADE_FEEDBACK[grade] ?? GRADE_FEEDBACK['C'];
  const feedback = pick(feedbackPool);

  return { marks, grade, feedback, perQuestionScores, topicRCA, improvementPlan, topicScores };
}

// ─── DB-backed evaluation functions ──────────────────────────────────────────

/**
 * Generates a dummy evaluation and persists it to Supabase.
 *
 * Writes to:
 *   • scores       — score, grade, feedback, topic_scores
 *   • evaluations  — marks, grade, feedback, full details jsonb
 *   • answer_sheets — status = 'evaluated'
 *
 * @param {string | null} answerSheetId
 * @param {{ studentId?: string, testId?: string, topics?: string[], totalMarks?: number }} params
 * @returns Full RCA evaluation object.
 */
export async function evaluateAnswerSheet(
  answerSheetId,
  { studentId, testId, topics = [], totalMarks = 100 } = {}
) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const evaluation = buildEvaluation(topics, totalMarks);
  const { marks, grade, feedback, topicScores, perQuestionScores, topicRCA, improvementPlan } = evaluation;

  if (studentId && testId) {
    const { error } = await supabase.from('scores').upsert(
      {
        student_id: studentId,
        test_id: testId,
        score: marks,
        topic_scores: topicScores,
        feedback,
        grade,
      },
      { onConflict: 'student_id,test_id' }
    );
    if (error) throw error;
  }

  if (answerSheetId) {
    // Write full details — non-fatal if migration 019 is not yet applied
    const { error: evalErr } = await supabase.from('evaluations').upsert(
      {
        answer_sheet_id: answerSheetId,
        marks,
        grade,
        feedback,
        details: { perQuestionScores, topicRCA, improvementPlan },
      },
      { onConflict: 'answer_sheet_id' }
    );
    if (evalErr) {
      console.warn('[eval] evaluations write failed (019 migration pending?):', evalErr.message);
    }

    await supabase.from('answer_sheets').update({ status: 'evaluated' }).eq('id', answerSheetId);
  }

  return evaluation;
}

/**
 * Creates an answer_sheet record then immediately evaluates it.
 *
 * @param {{ testId, studentId, teacherId, storagePath?, test?, student? }} params
 * @returns {{ answerSheetId, marks, grade, feedback, perQuestionScores, topicRCA, improvementPlan, topicScores }}
 */
export async function createAndEvaluate({
  testId,
  studentId,
  teacherId,
  storagePath = '',
  test = null,
  student = null,  // reserved for future use (e.g. personalised feedback)
}) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const topics = Array.isArray(test?.topics) ? test.topics : [];
  const totalMarks = test?.totalMarks ?? 100;

  const { data: sheet, error: sheetErr } = await supabase
    .from('answer_sheets')
    .insert({
      test_id: testId,
      student_id: studentId,
      uploaded_by_teacher_id: teacherId,
      storage_path: storagePath,
      bucket: storagePath ? 'answer-sheets' : '',
      status: 'processing',
    })
    .select('id')
    .single();

  if (sheetErr) throw sheetErr;

  const evaluation = await evaluateAnswerSheet(sheet.id, { studentId, testId, topics, totalMarks });
  return { answerSheetId: sheet.id, ...evaluation };
}

/**
 * Fetches all evaluations for a student, including full RCA details.
 * Joins answer_sheets → tests and evaluations so the caller gets everything
 * needed to render a report card in a single call.
 *
 * @param {string} studentId
 * @returns {Array}
 */
export async function getStudentEvaluations(studentId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('scores')
    .select('id, test_id, score, grade, feedback, topic_scores, graded_at, tests(title)')
    .eq('student_id', studentId)
    .order('graded_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
