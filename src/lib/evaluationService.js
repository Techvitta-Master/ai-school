/**
 * Dummy evaluation engine — does NOT call any AI API.
 * Persists marks into `results` only (normalized schema).
 */
import { upsertResult } from '../services/schoolService.js';

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

/**
 * Builds a full RCA evaluation result with no DB interaction.
 * @param {string[]} topics
 * @param {number} totalMarks
 */
export function buildEvaluation(topics = [], totalMarks = 100) {
  const NUM_QUESTIONS = 5;
  const effectiveTopics = topics.length > 0 ? topics : ['General'];

  const marks = Math.floor(Math.random() * 41) + 55;
  const grade = deriveGrade(marks);

  const maxPerQ = Math.floor(totalMarks / NUM_QUESTIONS);

  const perQuestionScores = Array.from({ length: NUM_QUESTIONS }, (_, i) => {
    const topic = effectiveTopics[i % effectiveTopics.length];
    const max = maxPerQ;

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

  const topicScores = Object.fromEntries(
    Object.entries(topicMap).map(([topic, { totalMax, totalScored }]) => [
      topic,
      Math.round((totalScored / totalMax) * 100),
    ])
  );

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

/**
 * Runs dummy evaluation and upserts `results` (same behavior as former Express route).
 */
export async function persistDummyEvaluation(supabase, { studentId, testId, topics = [], totalMarks = 100 }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const evaluation = buildEvaluation(topics, totalMarks);
  const marks = Number(evaluation.marks) || 0;
  const percentage = Number(((marks / totalMarks) * 100).toFixed(2));

  await upsertResult(supabase, studentId, testId, { marks, percentage });

  return {
    marks,
    grade: evaluation.grade,
    feedback: evaluation.feedback,
    perQuestionScores: evaluation.perQuestionScores,
    topicRCA: evaluation.topicRCA,
    improvementPlan: evaluation.improvementPlan,
    topicScores: evaluation.topicScores,
  };
}

export async function getStudentEvaluations(supabase, studentId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('results')
    .select('id, test_id, marks, percentage, created_at, tests(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    test_id: r.test_id,
    score: Number(r.marks) || 0,
    grade: null,
    feedback: null,
    topic_scores: {},
    graded_at: r.created_at,
    tests: r.tests,
  }));
}
