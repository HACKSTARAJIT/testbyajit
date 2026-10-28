import type { Tables } from '@/integrations/supabase/types';

export type CommandTask = Tables<'cgl_command_tasks'>;
export type RevisionSchedule = Tables<'spaced_revision_schedules'>;
export type Block = { name: string; start: string; end: string };
export type StudyConfig = {
  examName: string; baseline: number | null; targets: { name: string; score: number }[];
  dailyHours: number; weeklyMocks: number; accuracy: number; examDate: string;
  timezone: string; wake: string; freshenMinutes: number; breakMinutes: number;
  computerMinutes: number; typingMinutes: number; sectionalMinutes: number;
  subjects: string[]; weakTopics: string; blocks: Block[];
  revisionIntervals: number[]; retryDays: number; masterySuccesses: number;
};
export const defaultConfig: StudyConfig = {
  examName: 'SSC CGL Tier-2', baseline: null, targets: [], dailyHours: 8, weeklyMocks: 2,
  accuracy: 90, examDate: '', timezone: 'Asia/Kolkata', wake: '16:00', freshenMinutes: 30,
  breakMinutes: 10, computerMinutes: 30, typingMinutes: 20, sectionalMinutes: 45,
  subjects: ['Mathematics', 'Reasoning', 'English', 'General Awareness'], weakTopics: '',
  blocks: [{ name: 'Dinner', start: '19:30', end: '20:15' }, { name: 'Preparation / Travel', start: '06:30', end: '07:00' },
    { name: 'Ground / Training', start: '07:00', end: '08:30' }, { name: 'Breakfast', start: '08:30', end: '09:00' },
    { name: 'Sleep', start: '09:00', end: '16:00' }],
  revisionIntervals: [1, 3, 7, 14, 30], retryDays: 1, masterySuccesses: 5,
};
export function localDate(now = new Date(), timezone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export const minutesOf = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
export function preparationDate(config: StudyConfig, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const date = localDate(now, config.timezone);
  return minutesOf(parts) < minutesOf(config.wake) ? addDays(date, -1) : date;
}
export const displayMinute = (minute: number) => `${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}${minute >= 1440 ? ' (+1d)' : ''}`;
export function availableWindows(config: StudyConfig) {
  const wake = minutesOf(config.wake); const start = wake + config.freshenMinutes; const end = wake + 1440;
  const blocked: [number, number][] = [];
  for (const b of config.blocks) {
    const a = minutesOf(b.start), z = minutesOf(b.end); const duration = z <= a ? z + 1440 - a : z - a;
    for (const shift of [-1440, 0, 1440, 2880]) {
      const left = Math.max(start, a + shift), right = Math.min(end, a + shift + duration);
      if (right > left) blocked.push([left, right]);
    }
  }
  blocked.sort((a, b) => a[0] - b[0]);
  const windows: [number, number][] = []; let cursor = start;
  for (const [a, b] of blocked) { if (a > cursor) windows.push([cursor, a]); cursor = Math.max(cursor, b); }
  if (cursor < end) windows.push([cursor, end]);
  return windows;
}
type Schedulable = { id: string; start_minute: number | null; duration_minutes: number; locked: boolean; status: string; priority: string };
export function scheduleTasks<T extends Schedulable>(tasks: T[], config: StudyConfig) {
  const windows = availableWindows(config); const preserved = tasks.filter(t => t.locked || t.status === 'completed');
  const placed = new Map<string, number>(); const occupied: [number, number][] = [];
  const conflicts: string[] = [];
  for (const t of preserved) if (t.start_minute !== null) {
    const a = t.start_minute, b = a + t.duration_minutes;
    if (!windows.some(([x, y]) => a >= x && b <= y) || occupied.some(([x, y]) => a < y && b > x)) conflicts.push(t.id);
    occupied.push([a, b + config.breakMinutes]); placed.set(t.id, a);
  }
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  let budget = config.dailyHours * 60 - preserved.reduce((sum, t) => sum + t.duration_minutes, 0);
  const pending = tasks.filter(t => !t.locked && t.status !== 'completed' && t.status !== 'skipped').sort((a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2));
  for (const t of pending) {
    let found: number | null = null;
    if (t.duration_minutes <= budget) for (const [a, b] of windows) {
      for (let candidate = a; candidate + t.duration_minutes <= b;) {
        const hit = occupied.find(([x, y]) => candidate < y && candidate + t.duration_minutes + config.breakMinutes > x);
        if (hit) { candidate = hit[1]; continue; }
        found = candidate; break;
      }
      if (found !== null) break;
    }
    if (found === null) conflicts.push(t.id);
    else { placed.set(t.id, found); occupied.push([found, found + t.duration_minutes + config.breakMinutes]); occupied.sort((a, b) => a[0] - b[0]); budget -= t.duration_minutes; }
  }
  return { placed, conflicts };
}
export function taskConflict(task: Schedulable, others: Schedulable[], config: StudyConfig) {
  if (task.start_minute === null || task.status === 'skipped') return false;
  const a = task.start_minute, b = a + task.duration_minutes;
  return !availableWindows(config).some(([x, y]) => a >= x && b <= y) || others.some(t => t.id !== task.id && t.status !== 'skipped' && t.start_minute !== null && a < t.start_minute + t.duration_minutes && b > t.start_minute);
}
export function nextRevision(stage: number, result: string, date: string, config: StudyConfig, revealed = false) {
  const success = result === 'correct' && !revealed;
  const nextStage = success ? stage + 1 : 0;
  return { stage: nextStage, due: addDays(date, success ? config.revisionIntervals[Math.min(nextStage, config.revisionIntervals.length - 1)] : config.retryDays) };
}
export function revisionPriority(schedule: Pick<RevisionSchedule, 'due_date' | 'failures'>, today: string, wrongCount = 0) {
  const overdue = Math.max(0, Math.round((Date.parse(today) - Date.parse(schedule.due_date)) / 86400000));
  const score = wrongCount * 3 + schedule.failures * 5 + Math.min(overdue, 30) * 2;
  return { score, explanation: `${wrongCount} prior mistakes · ${schedule.failures} failed revisions · ${overdue} days overdue` };
}