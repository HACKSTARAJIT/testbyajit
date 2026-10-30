import { describe, expect, it } from 'vitest';
import { availableWindows, defaultConfig, nextRevision, preparationDate, revisionPriority, scheduleTasks, taskConflict } from '@/lib/cglPreparation';
import { calculatedAccuracy, emptyMock, emptySection, mocksCSV, normalizedScore, scoreSeries, validateMock } from '@/lib/externalMocks';

describe('CGL timetable', () => {
  it('respects all default unavailable periods and freshening up', () => {
    expect(availableWindows(defaultConfig)).toEqual([[990, 1170], [1215, 1830]]);
  });
  it('uses the previous preparation day before the 4 PM wake boundary', () => {
    expect(preparationDate(defaultConfig, new Date('2026-10-28T10:29:00Z'))).toBe('2026-10-27');
    expect(preparationDate(defaultConfig, new Date('2026-10-28T10:30:00Z'))).toBe('2026-10-28');
  });
  const task = (id: string, duration: number, start: number | null = null, locked = false, status = 'pending') => ({ id, duration_minutes: duration, start_minute: start, locked, status, priority: 'medium' });
  it('never moves locked or completed tasks', () => {
    const result = scheduleTasks([task('locked', 30, 1000, true), task('completed', 30, 1250, false, 'completed'), task('new', 40)], defaultConfig);
    expect(result.placed.get('locked')).toBe(1000); expect(result.placed.get('completed')).toBe(1250); expect(result.placed.get('new')).toBe(1040);
  });
  it('keeps impossible tasks as explicit conflicts rather than dropping them', () => {
    const result = scheduleTasks([task('too-long', 900)], defaultConfig);
    expect(result.conflicts).toEqual(['too-long']); expect(result.placed.has('too-long')).toBe(false);
  });
  it('rejects dinner overlap and task overlap', () => {
    expect(taskConflict(task('dinner', 30, 1170), [], defaultConfig)).toBe(true);
    expect(taskConflict(task('new', 30, 1000), [task('old', 30, 1010)], defaultConfig)).toBe(true);
    expect(taskConflict(task('safe', 30, 1215), [], defaultConfig)).toBe(false);
  });
});
describe('Spaced revision', () => {
  it('advances 3,7,14,30 days after successful R1 through R4', () => {
    expect(defaultConfig.revisionIntervals).toEqual([1, 3, 7, 14, 30]);
    expect([0, 1, 2, 3].map(stage => nextRevision(stage, 'correct', '2026-10-01', defaultConfig).due)).toEqual(['2026-10-04', '2026-10-08', '2026-10-15', '2026-10-31']);
  });
  it('failure, guessed and revealed answers retry in one day without advancing', () => {
    for (const outcome of ['incorrect', 'guessed', 'skipped', 'could_not_solve', 'concept_not_understood']) expect(nextRevision(3, outcome, '2026-10-01', defaultConfig)).toEqual({ stage: 0, due: '2026-10-02' });
    expect(nextRevision(3, 'correct', '2026-10-01', defaultConfig, true)).toEqual({ stage: 0, due: '2026-10-02' });
  });
  it('uses configured intervals and retry days', () => {
    expect(nextRevision(0, 'correct', '2026-10-01', { ...defaultConfig, revisionIntervals: [2, 5] }).due).toBe('2026-10-06');
    expect(nextRevision(2, 'incorrect', '2026-10-01', { ...defaultConfig, retryDays: 2 }).due).toBe('2026-10-03');
  });
  it('prioritizes repeated failures and overdue days deterministically', () => {
    expect(revisionPriority({ due_date: '2026-10-01', failures: 2 }, '2026-10-03', 3).score).toBe(23);
  });
});
describe('External mock validation and analytics', () => {
  it('permits manual score-only data without invented accuracy', () => {
    const d = { ...emptyMock('2026-10-01'), title: 'Mock 1', provider: 'Testbook', score: 145 };
    expect(validateMock(d).errors).toEqual([]); expect(calculatedAccuracy(d.correct, d.incorrect)).toBeNull();
  });
  it('calculates attempted-answer accuracy using correct plus incorrect', () => {
    expect(calculatedAccuracy(80, 20)).toBe(80); expect(calculatedAccuracy(0, 0)).toBeNull();
  });
  it('blocks impossible attempted counts', () => {
    const d = { ...emptyMock('2026-10-01'), title: 'Mock', provider: 'Testbook', score: 100, total: 100, attempted: 101 };
    expect(validateMock(d).errors).toContain('Overall: attempted exceeds total questions.');
  });
  it('warns rather than rejects external scoring differences and overtime', () => {
    const d = { ...emptyMock('2026-10-01'), title: 'Mock', provider: 'Testbook', score: 100, correct: 40, incorrect: 10, positive: 3, negative: 1, limit: 60, minutes: 61 };
    expect(validateMock(d).errors).toEqual([]); expect(validateMock(d).warnings).toHaveLength(2);
  });
  it('validates section counts separately', () => {
    const d = { ...emptyMock('2026-10-01'), title: 'Mock', provider: 'Testbook', score: 100, sections: [{ ...emptySection('English'), total: 10, attempted: 11 }] };
    expect(validateMock(d).errors).toContain('English: attempted exceeds total questions.');
  });
  it('normalizes different maxima and retains raw scores', () => {
    const a = { ...emptyMock('2026-10-01'), score: 100, maximum: 200 }, b = { ...emptyMock('2026-10-02'), score: 150, maximum: 300 };
    expect(normalizedScore(a.score, a.maximum)).toBe(50); expect(normalizedScore(b.score, b.maximum)).toBe(50);
    expect(scoreSeries([a, b]).map(p => p.raw)).toEqual([100, 150]);
  });
  it('exports actual values and escapes formulas and quotes', () => {
    const d = { ...emptyMock('2026-10-01'), title: '=unsafe,"quoted"', score: 145, maximum: 200 };
    const csv = mocksCSV([d]); expect(csv).toContain('145'); expect(csv).toContain('200'); expect(csv).toContain("'=unsafe"); expect(csv).toContain('""quoted""');
  });
});