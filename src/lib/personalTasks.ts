import type { Tables } from '@/integrations/supabase/types';

export type TaskList = Tables<'personal_task_lists'>;
export type PersonalTask = Tables<'personal_tasks'>;
export const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export const statusLabels: Record<string, string> = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };
export const taskTypes = ['Mock Test', 'Chapter', 'Class', 'Topic', 'Revision', 'Other'];
export function taskStats(tasks: Pick<PersonalTask, 'status'>[]) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  return { total, completed, pending: tasks.filter(t => t.status === 'PENDING').length, inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length, percentage: total ? completed / total * 100 : 0 };
}
export function marksPercentage(marks: number | null, maximum: number | null) {
  return marks !== null && maximum !== null && maximum > 0 && marks >= 0 && marks <= maximum ? marks / maximum * 100 : null;
}
export function marksStats(tasks: Pick<PersonalTask, 'marks_obtained' | 'maximum_marks'>[]) {
  const valid = tasks.filter(t => marksPercentage(t.marks_obtained, t.maximum_marks) !== null);
  if (!valid.length) return null;
  const values = valid.map(t => t.marks_obtained ?? 0);
  return { average: values.reduce((a,b) => a+b,0)/values.length, highest: Math.max(...values), lowest: Math.min(...values), percentage: valid.reduce((s,t) => s + (marksPercentage(t.marks_obtained,t.maximum_marks) ?? 0),0)/valid.length };
}
export function bulkTitles(prefix: string, start: number, end: number, existing: string[]) {
  if (!prefix.trim() || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) throw new Error('Enter a prefix and a valid whole-number range.');
  const names = Array.from({length: end-start+1}, (_,i) => `${prefix.trim()} ${start+i}`);
  const taken = new Set(existing.map(s => s.trim().toLocaleLowerCase()));
  const duplicate = names.find(s => taken.has(s.toLocaleLowerCase()));
  if (duplicate) throw new Error(`“${duplicate}” already exists. Change the range or prefix.`);
  return names;
}
export const formatValue = (value: number) => Number(value.toFixed(2)).toString();