import { describe, it, expect } from 'vitest';
import { bulkTitles, marksPercentage, marksStats, taskStats } from '@/lib/personalTasks';
describe('personal tracker rules', () => {
  it('creates exactly Mock 1 through Mock 30', () => { const names = bulkTitles('Mock',1,30,[]); expect(names).toHaveLength(30); expect(names[0]).toBe('Mock 1'); expect(names[29]).toBe('Mock 30'); });
  it('blocks duplicate bulk creation without overwriting', () => { expect(() => bulkTitles('Mock',1,30,['mock 1'])).toThrow(); });
  it('calculates 145/200 as 72.5%', () => { expect(marksPercentage(145,200)).toBe(72.5); });
  it('handles zero maximum safely', () => { expect(marksPercentage(145,0)).toBeNull(); });
  it('averages only valid marks as 148.5', () => { expect(marksStats([{marks_obtained:145,maximum_marks:200},{marks_obtained:152,maximum_marks:200},{marks_obtained:null,maximum_marks:null}])?.average).toBe(148.5); });
  it('counts each status separately and completion as 2/30', () => { const tasks = Array.from({length:30},(_,i) => ({status: i<2?'COMPLETED':i===2?'IN_PROGRESS':'PENDING'})); expect(taskStats(tasks)).toEqual({total:30,completed:2,pending:27,inProgress:1,percentage:2/30*100}); });
  it('returns zero completion without tasks', () => { expect(taskStats([]).percentage).toBe(0); });
  it('reopening changes progress without mutating marks', () => { const task = {status:'COMPLETED',marks_obtained:145,maximum_marks:200}; expect(taskStats([task]).completed).toBe(1); task.status='PENDING'; expect(taskStats([task]).completed).toBe(0); expect(task.marks_obtained).toBe(145); });
  it('shows no marks analytics for missing records', () => { expect(marksStats([{marks_obtained:null,maximum_marks:null}])).toBeNull(); });
});