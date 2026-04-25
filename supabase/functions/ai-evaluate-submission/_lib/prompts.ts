export type Language = "en" | "hi" | "indic" | "unknown";

const langInstruction = (lang: Language): string => {
  if (lang === "hi") return "The student's answer is in Hindi (Devanagari). Grade as written; do not translate. Use English for all field names and metadata.";
  if (lang === "indic") return "The student's answer is in an Indic language. Grade as written; do not translate. Use English for all field names and metadata.";
  return "Grade in English.";
};

export type ParsedQuestion = {
  question_no: string;
  question_text: string;
  model_answer: string;
  max_marks: number;
  topic: string;
  key_concepts: string[];
  student_answer: string;
  student_answer_present: boolean;
  alignment_confidence: number;
};

export const EXTRACT_AND_PAIR_SYSTEM = `You are a strict JSON extractor for a CBSE/ICSE-style school grading system.
You will receive three OCR-extracted texts: a question paper, an answer key, and a student's answer sheet.
Your job is to produce a single JSON object pairing each question with its model answer and the student's response.

Rules:
1. Output ONLY valid JSON, no commentary, no code fences.
2. Pair items by normalised question number. Accept "Q1", "1.", "1)", "1(a)", Roman numerals, and Devanagari numerals (e.g. "१", "३").
3. If the question paper is missing or empty, derive question_text from the answer key context (it may be implied).
4. If a question has no student answer, emit it with student_answer_present=false and student_answer="".
5. Never invent questions. If you are unsure, lower alignment_confidence.
6. Default max_marks to 5 when not specified.
7. Cap each text field at 1500 characters.

CRITICAL RULES — these protect grading integrity:
A. model_answer MUST be copied verbatim from the ANSWER_KEY only. NEVER copy from the STUDENT_ANSWER. NEVER paraphrase or invent it.
B. If the ANSWER_KEY is empty, garbled, or clearly belongs to a DIFFERENT subject/document
   (e.g. ANSWER_KEY is a résumé, an unrelated chapter, financial document, or wrong test paper),
   set model_answer to "" for EVERY question and add the warning code to input_warnings.
C. If the ANSWER_KEY text is essentially the same as the STUDENT_ANSWER text
   (i.e. they were extracted from the same source), treat the answer key as missing:
   set model_answer to "" for EVERY question and warn 'answer_key_same_as_student'.

input_warnings codes (use exactly these strings):
  - "answer_key_empty"          : the answer key text is missing or near-empty
  - "answer_key_unrelated"      : the answer key is on a different topic/subject than the question paper
  - "answer_key_same_as_student": the answer key text matches the student answer text
  - "questions_low_confidence"  : questions could not be parsed reliably

Schema:
{
  "input_warnings": string[],
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

export function extractAndPairUserPrompt(args: { questionPaper: string; answerKey: string; studentAnswer: string }): string {
  return [
    "QUESTION_PAPER:",
    args.questionPaper || "(empty)",
    "",
    "ANSWER_KEY:",
    args.answerKey || "(empty)",
    "",
    "STUDENT_ANSWER:",
    args.studentAnswer || "(empty)",
  ].join("\n");
}

export type Judgment = {
  score: number;
  key_concepts_present: string[];
  missed_concepts: string[];
  factual_errors: string[];
  structural_issues: string[];
  improvement_areas: string[];
  suggested_format: string;
  exemplar_answer: string;
  subtopic: string;
  bloom_level: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create" | string;
  confidence: number;
  reasoning: string;
};

export const JUDGE_SYSTEM = `You are an experienced CBSE/ICSE examiner. Grade ONE answer using the rubric below.
Output ONLY valid JSON. No commentary, no code fences. Be strict but fair.

Rubric (apply by content match against the model answer when one exists,
otherwise grade against the question and your subject knowledge):
  0           blank, completely irrelevant, or copies the question verbatim
  20% of max  one key term mentioned, no real understanding
  40% of max  partial concept present, major gap or error
  60% of max  correct concept, missing detail or structure
  80% of max  correct and well-structured, with minor errors
  100% of max complete, accurate, well-formatted, exam-ready

CRITICAL:
- If MODEL_ANSWER is empty or "(not provided)", grade strictly using the QUESTION and your subject knowledge.
  Do NOT assume the student's answer is correct. Cap confidence at 0.6 in this mode.
- If STUDENT_ANSWER is blank, repeats the question verbatim, or is clearly off-topic from the question, score 0.
- Never claim "the student's answer matches the model answer" when MODEL_ANSWER is empty.

For "exemplar_answer", produce a model student response that would score 100% — written in the same language as the student's answer, in plain prose suitable for a school answer sheet (no markdown).
For "suggested_format", give one paragraph of concrete structural advice ("start with definition, then equation, then diagram").
"reasoning" is a single sentence justifying the score.

Schema:
{
  "score": number (0..max_marks, can be a decimal),
  "key_concepts_present": string[],
  "missed_concepts": string[],
  "factual_errors": string[],
  "structural_issues": string[],
  "improvement_areas": string[],
  "suggested_format": string,
  "exemplar_answer": string,
  "subtopic": string,
  "bloom_level": "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create",
  "confidence": number (0..1),
  "reasoning": string
}`;

export function judgeUserPrompt(args: {
  questionNo: string;
  questionText: string;
  modelAnswer: string;
  studentAnswer: string;
  maxMarks: number;
  topic: string;
  keyConcepts: string[];
  language: Language;
}): string {
  return [
    `QUESTION_NO: ${args.questionNo}`,
    `TOPIC: ${args.topic || "general"}`,
    `MAX_MARKS: ${args.maxMarks}`,
    `KEY_CONCEPTS: ${(args.keyConcepts || []).join(", ") || "(not provided)"}`,
    `LANGUAGE_HINT: ${langInstruction(args.language)}`,
    "",
    "QUESTION:",
    args.questionText || "(question text not extracted; infer from model answer)",
    "",
    "MODEL_ANSWER:",
    args.modelAnswer || "(not provided)",
    "",
    "STUDENT_ANSWER:",
    args.studentAnswer || "(blank)",
  ].join("\n");
}

export type PlanOutput = {
  plan_text: string;
  weak_topics: string[];
  topic_breakdown: Array<{ topic: string; mastery: number; missed: string[]; focus: string }>;
  tasks: Array<{ title: string; why: string; how: string; est_minutes: number }>;
};

export const PLAN_SYSTEM = `You are a supportive CBSE/ICSE study coach writing to a school student.
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

export function planUserPrompt(args: {
  testName: string;
  totalMarks: number;
  obtainedMarks: number;
  perQuestion: Array<{
    question_no: string;
    score: number;
    max_score: number;
    topic: string;
    missed: string[];
    present: string[];
    reasoning: string;
  }>;
}): string {
  const lines = args.perQuestion.map((q) =>
    `- ${q.question_no} (${q.topic || "general"}): ${q.score}/${q.max_score} | got: ${q.present.slice(0, 4).join("; ") || "none"} | missed: ${q.missed.slice(0, 4).join("; ") || "none"}`
  );
  return [
    `TEST: ${args.testName}`,
    `TOTAL: ${args.obtainedMarks}/${args.totalMarks}`,
    "",
    "PER-QUESTION SUMMARY:",
    ...lines,
  ].join("\n");
}
