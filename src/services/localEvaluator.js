// Bridge between the teacher workbench and the local Node evaluation server
// (scripts/local-evaluate-server.mjs). Used when VITE_USE_LOCAL_EVALUATOR=true,
// so the new pipeline can be exercised end-to-end before the Supabase migration
// + edge function deploy land.
import { extractPdfText, isPdfFile } from '../lib/pdfText';

const API_URL = import.meta.env.VITE_LOCAL_EVAL_URL || 'http://127.0.0.1:8787/api/evaluate';

async function fileToText(file, onProgress) {
  if (!file) return '';
  if (isPdfFile(file)) {
    const result = await extractPdfText(file, { onProgress });
    return result.text || '';
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

export async function runLocalEvaluation({ questionPaperFile, answerKeyFile, studentAnswerFile, onProgress }) {
  if (!studentAnswerFile) throw new Error('Student answer file is required.');

  const stage = (label) => onProgress?.({ stage: label });

  stage('Extracting text from question paper...');
  const questionPaper = questionPaperFile ? await fileToText(questionPaperFile, (p) => onProgress?.({ ...p, file: 'question_paper' })) : '';

  stage('Extracting text from answer key...');
  const answerKey = answerKeyFile ? await fileToText(answerKeyFile, (p) => onProgress?.({ ...p, file: 'answer_key' })) : '';

  stage('Extracting text from student answer...');
  const studentAnswer = await fileToText(studentAnswerFile, (p) => onProgress?.({ ...p, file: 'student_answer' }));

  stage('Sending to AI evaluation pipeline...');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionPaper, answerKey, studentAnswer }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Local evaluator returned ${res.status}`);
  return body;
}

export const isLocalEvaluatorEnabled = () =>
  String(import.meta.env.VITE_USE_LOCAL_EVALUATOR || '').toLowerCase() === 'true';
