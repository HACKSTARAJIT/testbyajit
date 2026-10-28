import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, NumericField } from './PreparationUI';
import { calculatedAccuracy, emptySection, examSections, numberText, validateMock, type ExternalDetails, type Section } from '@/lib/externalMocks';
import { Plus, Trash2 } from 'lucide-react';

export default function ExternalMockForm({ initial, saving, onSave }: { initial: ExternalDetails; saving: boolean; onSave: (data: ExternalDetails) => Promise<void> }) {
  const [d, setD] = useState(initial); const [messages, setMessages] = useState<string[]>([]); const [confirmed, setConfirmed] = useState(false);
  const set = <K extends keyof ExternalDetails>(key: K, value: ExternalDetails[K]) => { setD(old => ({ ...old, [key]: value })); setConfirmed(false); setMessages([]); };
  const sectionSet = <K extends keyof Section>(index: number, key: K, value: Section[K]) => set('sections', d.sections.map((s, i) => i === index ? { ...s, [key]: value } : s));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); const validation = validateMock(d);
    if (validation.errors.length) { setMessages(validation.errors); return; }
    if (validation.warnings.length && !confirmed) { setMessages(validation.warnings); setConfirmed(true); return; }
    try { await onSave(d); } catch { /* Parent write displays error, keep form open. */ }
  };
  const numeric: [keyof ExternalDetails, string][] = [['score', 'Score obtained'], ['maximum', 'Maximum marks'], ['total', 'Total questions'], ['attempted', 'Attempted'], ['correct', 'Correct'], ['incorrect', 'Incorrect'], ['unattempted', 'Unattempted'], ['minutes', 'Time taken (minutes)'], ['limit', 'Time limit (minutes)'], ['sourceAccuracy', 'Source accuracy (%)'], ['percentile', 'Percentile'], ['rank', 'Rank'], ['candidates', 'Total candidates'], ['positive', 'Marks per correct'], ['negative', 'Penalty per incorrect']];
  return <form className="space-y-5" onSubmit={submit}>
    <div className="grid gap-3 sm:grid-cols-2">
      {(['title', 'number', 'exam', 'provider'] as const).map(key => <Field key={key} label={{ title: 'Mock title', number: 'Mock number (optional)', exam: 'Exam name', provider: 'Test provider' }[key]}><Input value={d[key]} onChange={e => set(key, e.target.value)} required={key !== 'number'} /></Field>)}
      <Field label="Test date"><Input type="date" value={d.date} onChange={e => set('date', e.target.value)} required /></Field>
      <Field label="Test type"><Select value={d.type} onValueChange={v => set('type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Full Mock', 'Sectional Mock', 'Previous Year Paper', 'Custom Test'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></Field>
      {numeric.map(([key, label]) => <NumericField key={key} label={label} value={d[key] as number | null} onChange={v => set(key, v as never)} />)}
    </div>
    <p className="text-sm text-muted-foreground">Calculated accuracy: {numberText(calculatedAccuracy(d.correct, d.incorrect))}% · Correct ÷ (Correct + Incorrect) × 100</p>
    <section className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Subject / section results</h3><Button type="button" variant="outline" size="sm" onClick={() => set('sections', [...d.sections, emptySection()])}><Plus className="mr-1 h-4 w-4" />Add section</Button></div>
      {d.sections.length === 0 && <p className="text-sm text-muted-foreground">Score-only entry. No individual question analysis.</p>}
      {d.sections.map((s, i) => <div key={i} className="space-y-3 border-b pb-4">
        <div className="flex gap-2"><Field label={`Section ${i + 1} name`}><Input list="cgl-section-names" value={s.name} onChange={e => sectionSet(i, 'name', e.target.value)} /></Field><Button type="button" variant="ghost" size="icon" className="mt-6 shrink-0" aria-label={`Remove section ${i + 1}`} onClick={() => set('sections', d.sections.filter((_, index) => index !== i))}><Trash2 className="h-4 w-4" /></Button></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{(['score', 'maximum', 'total', 'attempted', 'correct', 'incorrect', 'unattempted', 'minutes', 'sourceAccuracy'] as const).map(key => <NumericField key={key} label={{ score: 'Marks obtained', maximum: 'Maximum marks', total: 'Total questions', attempted: 'Attempted', correct: 'Correct', incorrect: 'Incorrect', unattempted: 'Unattempted', minutes: 'Minutes', sourceAccuracy: 'Source accuracy (%)' }[key]} value={s[key]} onChange={v => sectionSet(i, key, v)} />)}</div>
        <Field label="Section notes"><Textarea value={s.notes} onChange={e => sectionSet(i, 'notes', e.target.value)} /></Field>
      </div>)}
      <datalist id="cgl-section-names">{examSections.map(s => <option key={s} value={s} />)}</datalist>
    </section>
    <Field label="Notes"><Textarea value={d.notes} onChange={e => set('notes', e.target.value)} /></Field>
    {messages.length > 0 && <div role="alert" className="space-y-1 rounded-md border border-warning p-3 text-sm">{messages.map(m => <p key={m}>{m}</p>)}</div>}
    <Button className="w-full" type="submit" disabled={saving}>{saving ? 'Saving…' : confirmed ? 'Confirm warnings & save' : 'Save external mock'}</Button>
  </form>;
}