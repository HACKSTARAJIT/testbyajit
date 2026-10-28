import type { Tables } from '@/integrations/supabase/types';
export type Section = { name: string; maximum: number | null; score: number | null; total: number | null; attempted: number | null; correct: number | null; incorrect: number | null; unattempted: number | null; minutes: number | null; sourceAccuracy: number | null; notes: string };
export type ExternalDetails = {
  number: string; title: string; exam: string; provider: string; date: string; type: string;
  maximum: number | null; score: number | null; total: number | null; attempted: number | null;
  correct: number | null; incorrect: number | null; unattempted: number | null;
  limit: number | null; minutes: number | null; percentile: number | null; rank: number | null;
  candidates: number | null; sourceAccuracy: number | null; positive: number | null; negative: number | null;
  notes: string; sections: Section[]; linkedMocks: string[];
};
export type ExternalRow = Tables<'imported_mock_reports'>;
export const examSections = ['Mathematical Abilities', 'Reasoning and General Intelligence', 'English Language and Comprehension', 'General Awareness', 'Computer Knowledge Test', 'DEST / Typing'];
export const emptySection = (name = ''): Section => ({ name, maximum: null, score: null, total: null, attempted: null, correct: null, incorrect: null, unattempted: null, minutes: null, sourceAccuracy: null, notes: '' });
export const emptyMock = (date: string): ExternalDetails => ({ number: '', title: '', exam: 'SSC CGL Tier-2', provider: '', date, type: 'Full Mock', maximum: null, score: null, total: null, attempted: null, correct: null, incorrect: null, unattempted: null, limit: null, minutes: null, percentile: null, rank: null, candidates: null, sourceAccuracy: null, positive: null, negative: null, notes: '', sections: [], linkedMocks: [] });
export const calculatedAccuracy = (correct: number | null, incorrect: number | null) => correct !== null && incorrect !== null && correct + incorrect > 0 ? correct / (correct + incorrect) * 100 : null;
export const normalizedScore = (score: number | null, maximum: number | null) => score !== null && maximum !== null && maximum > 0 ? score / maximum * 100 : null;
export const detailsOf = (row: ExternalRow) => row.manual_details as unknown as ExternalDetails;
export const numberText = (n: number | null | undefined) => n === null || n === undefined ? '—' : Number(n.toFixed(2)).toString();
export function validateMock(d: ExternalDetails) {
  const errors: string[] = [], warnings: string[] = [];
  if (!d.title.trim() || !d.provider.trim() || !d.date || !d.exam.trim()) errors.push('Enter title, provider, exam and test date.');
  if (d.score === null) errors.push('Enter the overall score. Detailed counts are optional.');
  const check = (s: Partial<ExternalDetails & Section>, prefix: string) => {
    for (const key of ['total', 'attempted', 'correct', 'incorrect', 'unattempted'] as const) if (s[key] !== null && s[key] !== undefined && (!Number.isInteger(s[key]) || (s[key] ?? 0) < 0)) errors.push(`${prefix}: ${key} must be a non-negative whole number.`);
    if (s.maximum !== null && s.maximum !== undefined && s.maximum <= 0) errors.push(`${prefix}: maximum marks must be positive.`);
    if (s.minutes !== null && s.minutes !== undefined && s.minutes < 0) errors.push(`${prefix}: time must be non-negative.`);
    if (s.total !== null && s.total !== undefined && s.attempted !== null && s.attempted !== undefined && s.attempted > s.total) errors.push(`${prefix}: attempted exceeds total questions.`);
    for (const key of ['correct', 'incorrect'] as const) if (s[key] !== null && s[key] !== undefined && s.attempted !== null && s.attempted !== undefined && (s[key] ?? 0) > s.attempted) errors.push(`${prefix}: ${key} exceeds attempted.`);
    if (s.correct !== null && s.correct !== undefined && s.incorrect !== null && s.incorrect !== undefined) {
      if (s.attempted !== null && s.attempted !== undefined && s.correct + s.incorrect !== s.attempted) warnings.push(`${prefix}: correct + incorrect differs from attempted.`);
      if (s.total !== null && s.total !== undefined && s.unattempted !== null && s.unattempted !== undefined && s.correct + s.incorrect + s.unattempted !== s.total) warnings.push(`${prefix}: question counts do not account for total.`);
    }
    if (s.score !== null && s.score !== undefined && s.maximum !== null && s.maximum !== undefined && s.score > s.maximum) warnings.push(`${prefix}: score exceeds maximum; verify the source convention.`);
    if (s.sourceAccuracy !== null && s.sourceAccuracy !== undefined && (s.sourceAccuracy < 0 || s.sourceAccuracy > 100)) errors.push(`${prefix}: source accuracy must be 0–100.`);
  };
  check(d, 'Overall'); d.sections.forEach((s, i) => { if (!s.name.trim()) errors.push(`Section ${i + 1}: enter a name.`); check(s, s.name || `Section ${i + 1}`); });
  if (d.limit !== null && d.limit <= 0) errors.push('Time limit must be positive.');
  if (d.minutes !== null && d.limit !== null && d.minutes > d.limit) warnings.push('Time exceeds the configured limit. Confirm that this is the source result.');
  if (d.percentile !== null && (d.percentile < 0 || d.percentile > 100)) errors.push('Percentile must be 0–100.');
  for (const key of ['rank', 'candidates'] as const) if (d[key] !== null && (!Number.isInteger(d[key]) || (d[key] ?? 0) <= 0)) errors.push(`${key} must be a positive whole number.`);
  if (d.rank !== null && d.candidates !== null && d.rank > d.candidates) warnings.push('Rank exceeds total candidates.');
  if ((d.positive !== null && d.positive < 0) || (d.negative !== null && d.negative < 0)) errors.push('Marking values must be non-negative.');
  if (d.positive !== null && d.negative !== null && d.correct !== null && d.incorrect !== null && d.score !== null && Math.abs(d.correct * d.positive - d.incorrect * d.negative - d.score) > 0.01) warnings.push('Score differs from the configured marking scheme. Confirm the external scoring convention.');
  return { errors, warnings };
}
export function scoreSeries(records: ExternalDetails[]) {
  return [...records].sort((a, b) => a.date.localeCompare(b.date)).map((r, i, all) => {
    const recent = all.slice(Math.max(0, i - 4), i + 1).map(x => normalizedScore(x.score, x.maximum)).filter((v): v is number => v !== null);
    return { date: r.date, title: r.title, raw: r.score, percentage: normalizedScore(r.score, r.maximum), average: recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null };
  });
}
export function mockInsights(records: ExternalDetails[]) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date)); const result: string[] = [];
  for (const name of [...new Set(sorted.flatMap(d => d.sections.map(s => s.name)))]) {
    const points = sorted.flatMap(d => d.sections.filter(s => s.name === name).map(s => ({ score: normalizedScore(s.score, s.maximum), accuracy: calculatedAccuracy(s.correct, s.incorrect) })));
    const values = points.map(p => p.score).filter((v): v is number => v !== null);
    if (values.length >= 3) result.push(`${name}: normalized score ${numberText(values[0])}% → ${numberText(values[values.length - 1])}% across ${values.length} recorded mocks.`);
    const accuracy = points.map(p => p.accuracy).filter((v): v is number => v !== null);
    if (accuracy.length >= 3) result.push(`${name}: accuracy ${numberText(accuracy[0])}% → ${numberText(accuracy[accuracy.length - 1])}% (n=${accuracy.length}).`);
  }
  return result;
}
export function mocksCSV(records: ExternalDetails[]) {
  const fields: (keyof ExternalDetails)[] = ['number', 'title', 'exam', 'provider', 'date', 'type', 'score', 'maximum', 'total', 'attempted', 'correct', 'incorrect', 'unattempted', 'minutes', 'limit', 'sourceAccuracy', 'percentile', 'rank', 'candidates', 'positive', 'negative', 'notes'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/^[=+@\-]/, "'$&").replace(/"/g, '""')}"`;
  return [fields.join(',') + ',calculated_accuracy,sections', ...records.map(r => [...fields.map(f => escape(r[f])), escape(calculatedAccuracy(r.correct, r.incorrect)), escape(JSON.stringify(r.sections))].join(','))].join('\r\n');
}