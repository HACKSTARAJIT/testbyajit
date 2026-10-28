import { useState } from 'react';
import { type StudyConfig } from '@/lib/cglPreparation';
import { Field, NumericField } from './PreparationUI';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';

export default function StudySettingsForm({ initial, saving, onSave }: { initial: StudyConfig; saving: boolean; onSave: (config: StudyConfig) => Promise<void> }) {
  const [c, setC] = useState(initial); const [intervals, setIntervals] = useState(c.revisionIntervals.join(',')); const [error, setError] = useState('');
  const set = <K extends keyof StudyConfig>(key: K, value: StudyConfig[K]) => setC(old => ({ ...old, [key]: value }));
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const parsed = intervals.split(',').map(Number);
    try { new Intl.DateTimeFormat('en', { timeZone: c.timezone }); } catch { setError('Enter a valid timezone, such as Asia/Kolkata.'); return; }
    if (parsed.some(x => !Number.isInteger(x) || x < 1 || x > 365) || !parsed.length || c.dailyHours <= 0 || c.dailyHours > 24 || c.weeklyMocks < 0 || !Number.isInteger(c.weeklyMocks) || c.masterySuccesses < 1 || c.retryDays < 1 || c.breakMinutes < 0 || c.freshenMinutes < 0 || c.computerMinutes < 0 || c.typingMinutes < 0 || c.sectionalMinutes <= 0 || c.accuracy < 0 || c.accuracy > 100) { setError('Check durations, targets and positive whole-day revision intervals (1–365).'); return; }
    setError(''); try { await onSave({ ...c, revisionIntervals: parsed }); } catch {} };
  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-3 sm:grid-cols-2">
    <Field label="Exam name"><Input required value={c.examName} onChange={e => set('examName', e.target.value)} /></Field><Field label="Exam date"><Input type="date" value={c.examDate} onChange={e => set('examDate', e.target.value)} /></Field>
    <NumericField label="Baseline score (optional)" value={c.baseline} onChange={v => set('baseline', v)} />
    {([['dailyHours', 'Daily study hours'], ['weeklyMocks', 'Full mocks per week'], ['accuracy', 'Target accuracy (%)'], ['sectionalMinutes', 'Each daily sectional (minutes)'], ['computerMinutes', 'Computer target (minutes)'], ['typingMinutes', 'Typing target (minutes)'], ['freshenMinutes', 'Freshening-up buffer (minutes)'], ['breakMinutes', 'Break between tasks (minutes)'], ['retryDays', 'Failed revision retry (days)'], ['masterySuccesses', 'Mastery: consecutive successes']] as const).map(([key, label]) => <NumericField key={key} label={label} value={c[key]} onChange={v => set(key, v ?? 0)} min={0} />)}
    <Field label="Wake-up time"><Input type="time" value={c.wake} onChange={e => set('wake', e.target.value)} required /></Field><Field label="Timezone"><Input value={c.timezone} onChange={e => set('timezone', e.target.value)} required /></Field>
    <Field label="Revision intervals (days)"><Input value={intervals} onChange={e => setIntervals(e.target.value)} required /></Field>
  </div>
    <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Score targets</h3>{c.targets.map((t, i) => <div className="flex items-end gap-2" key={i}><Field label="Target name"><Input value={t.name} onChange={e => set('targets', c.targets.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} required /></Field><NumericField label="Marks" value={t.score} onChange={v => set('targets', c.targets.map((x, j) => j === i ? { ...x, score: v ?? 0 } : x))} /><Button type="button" variant="ghost" size="icon" aria-label="Remove target" onClick={() => set('targets', c.targets.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}<Button type="button" variant="outline" size="sm" onClick={() => set('targets', [...c.targets, { name: '', score: 0 }])}><Plus className="mr-1 h-4 w-4" />Add target</Button></section>
    <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Unavailable periods</h3>{c.blocks.map((b, i) => <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" key={i}><Field label="Period"><Input value={b.name} onChange={e => set('blocks', c.blocks.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></Field>{(['start', 'end'] as const).map(key => <Field key={key} label={key === 'start' ? 'From' : 'To'}><Input type="time" required value={b[key]} onChange={e => set('blocks', c.blocks.map((x, j) => j === i ? { ...x, [key]: e.target.value } : x))} /></Field>)}</div>)}</section>
    <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Daily subjects</h3><div className="flex flex-wrap gap-4">{['Mathematics', 'Reasoning', 'English', 'General Awareness'].map(s => <label key={s} className="flex items-center gap-2 text-sm"><Checkbox checked={c.subjects.includes(s)} onCheckedChange={v => set('subjects', v ? [...c.subjects, s] : c.subjects.filter(x => x !== s))} />{s}</label>)}</div><Field label="Known weak subjects / topics (your notes)"><Textarea value={c.weakTopics} onChange={e => set('weakTopics', e.target.value)} /></Field></section>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save preparation settings'}</Button>
  </form>;
}