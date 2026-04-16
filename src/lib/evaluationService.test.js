import { describe, it, expect } from 'vitest';
import { buildEvaluation } from './evaluationService';

describe('buildEvaluation — output shape', () => {
  it('returns all required top-level keys', () => {
    const result = buildEvaluation(['Math', 'Science']);
    expect(result).toHaveProperty('marks');
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('feedback');
    expect(result).toHaveProperty('perQuestionScores');
    expect(result).toHaveProperty('topicRCA');
    expect(result).toHaveProperty('improvementPlan');
    expect(result).toHaveProperty('topicScores');
  });

  it('topicRCA has weak and strong arrays', () => {
    const { topicRCA } = buildEvaluation(['A', 'B']);
    expect(Array.isArray(topicRCA.weak)).toBe(true);
    expect(Array.isArray(topicRCA.strong)).toBe(true);
  });

  it('improvementPlan has exactly 3 items', () => {
    const { improvementPlan } = buildEvaluation(['X']);
    expect(improvementPlan).toHaveLength(3);
    improvementPlan.forEach((item) => expect(typeof item).toBe('string'));
  });
});

describe('buildEvaluation — topic usage', () => {
  it('uses provided topics in perQuestionScores', () => {
    const topics = ['Algebra', 'Geometry'];
    const { perQuestionScores } = buildEvaluation(topics);
    perQuestionScores.forEach((q) => {
      expect(topics).toContain(q.topic);
    });
  });

  it('falls back to "General" when no topics are provided', () => {
    const { perQuestionScores } = buildEvaluation([]);
    perQuestionScores.forEach((q) => {
      expect(q.topic).toBe('General');
    });
  });

  it('cycles topics when there are fewer topics than questions', () => {
    const { perQuestionScores } = buildEvaluation(['OnlyTopic']);
    perQuestionScores.forEach((q) => {
      expect(q.topic).toBe('OnlyTopic');
    });
  });
});

describe('buildEvaluation — question scoring', () => {
  it('generates exactly 5 questions', () => {
    const { perQuestionScores } = buildEvaluation(['T1']);
    expect(perQuestionScores).toHaveLength(5);
  });

  it('each question has scored between 0 and max inclusive', () => {
    for (let i = 0; i < 20; i++) {
      const { perQuestionScores } = buildEvaluation(['T1', 'T2', 'T3']);
      perQuestionScores.forEach((q) => {
        expect(q.scored).toBeGreaterThanOrEqual(0);
        expect(q.scored).toBeLessThanOrEqual(q.max);
      });
    }
  });

  it('question labels are Q1 through Q5', () => {
    const { perQuestionScores } = buildEvaluation(['A']);
    const labels = perQuestionScores.map((q) => q.q);
    expect(labels).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
  });

  it('each question has a non-empty remark string', () => {
    const { perQuestionScores } = buildEvaluation(['T']);
    perQuestionScores.forEach((q) => {
      expect(typeof q.remark).toBe('string');
      expect(q.remark.length).toBeGreaterThan(0);
    });
  });
});

describe('buildEvaluation — marks and grade', () => {
  it('marks is within the 55–95 range', () => {
    for (let i = 0; i < 200; i++) {
      const { marks } = buildEvaluation();
      expect(marks).toBeGreaterThanOrEqual(55);
      expect(marks).toBeLessThanOrEqual(95);
    }
  });

  it('grade band matches marks', () => {
    for (let i = 0; i < 200; i++) {
      const { marks, grade } = buildEvaluation();
      if (marks >= 90) expect(grade).toBe('A+');
      else if (marks >= 80) expect(grade).toBe('A');
      else if (marks >= 70) expect(grade).toBe('B+');
      else if (marks >= 60) expect(grade).toBe('B');
      else if (marks >= 50) expect(grade).toBe('C');
      else expect(grade).toBe('D');
    }
  });
});

describe('buildEvaluation — topic RCA thresholds', () => {
  it('topicRCA.weak entries have score < 60', () => {
    // Run many times to hit at least one weak topic scenario
    const allResults = Array.from({ length: 100 }, () =>
      buildEvaluation(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'])
    );
    const withWeak = allResults.filter((r) => r.topicRCA.weak.length > 0);
    expect(withWeak.length).toBeGreaterThan(0); // should occur at least once
    withWeak.forEach(({ topicRCA }) => {
      topicRCA.weak.forEach((w) => {
        expect(w.score).toBeLessThan(60);
        expect(typeof w.topic).toBe('string');
        expect(typeof w.reason).toBe('string');
      });
    });
  });

  it('topicRCA.strong entries have score >= 80', () => {
    const allResults = Array.from({ length: 100 }, () =>
      buildEvaluation(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'])
    );
    const withStrong = allResults.filter((r) => r.topicRCA.strong.length > 0);
    expect(withStrong.length).toBeGreaterThan(0);
    withStrong.forEach(({ topicRCA }) => {
      topicRCA.strong.forEach((s) => {
        expect(s.score).toBeGreaterThanOrEqual(80);
        expect(typeof s.topic).toBe('string');
        expect(typeof s.reason).toBe('string');
      });
    });
  });
});

describe('buildEvaluation — topicScores backward compat', () => {
  it('topicScores is a flat object keyed by topic name', () => {
    const topics = ['Physics', 'Chemistry'];
    const { topicScores } = buildEvaluation(topics);
    expect(typeof topicScores).toBe('object');
    topics.forEach((t) => expect(topicScores).toHaveProperty(t));
    Object.values(topicScores).forEach((v) => {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});
