export type CalibrationInput = {
  llmScore: number;
  maxMarks: number;
  similarity: number;
  questionSimilarity: number;
  confidence: number;
  crossLingual: boolean;
};

export type CalibrationOutput = {
  finalScore: number;
  needsReview: boolean;
  reasons: string[];
};

export function calibrate(input: CalibrationInput): CalibrationOutput {
  const reasons: string[] = [];
  const max = Math.max(1, input.maxMarks);
  const llmRatio = Math.max(0, Math.min(1, input.llmScore / max));
  const sim = Math.max(0, Math.min(1, input.similarity));
  const qSim = Math.max(0, Math.min(1, input.questionSimilarity));
  const disagreementThreshold = input.crossLingual ? 0.55 : 0.4;

  const plagiarism = sim <= qSim + 0.1 && qSim > 0.4 && input.llmScore > 0;
  if (plagiarism) reasons.push("answer too similar to the question text");

  const disagreement = Math.abs(llmRatio - sim) > disagreementThreshold;
  if (disagreement) reasons.push("LLM and semantic similarity disagree");

  if (input.confidence < 0.6) reasons.push(`low LLM confidence (${input.confidence.toFixed(2)})`);

  let finalScore = input.llmScore;
  if (plagiarism) finalScore = Math.min(input.llmScore, max * 0.2);
  finalScore = Math.max(0, Math.min(max, Math.round(finalScore * 100) / 100));

  return {
    finalScore,
    needsReview: plagiarism || disagreement || input.confidence < 0.6,
    reasons,
  };
}

export function fallbackEmbeddingScore(similarity: number, maxMarks: number): number {
  const sim = Math.max(0, Math.min(1, similarity));
  const adjusted = Math.max(0, sim - 0.25) / 0.75;
  return Math.round(adjusted * maxMarks * 100) / 100;
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
