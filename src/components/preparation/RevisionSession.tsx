import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePreparationWrite } from '@/hooks/useCglPreparation';
import type { RevisionSchedule } from '@/lib/cglPreparation';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Field } from './PreparationUI';
import { Eye, ArrowRight } from 'lucide-react';

type RevisionQuestion = { text: string; options: Record<string, string | null>; previous: string | null; correct: string | null; explanation: string | null; has_answer: boolean; topic: string | null; subject: string | null; chapter: string | null; source: string | null };
export default function RevisionSession({ schedules, duration, onClose }: { schedules: RevisionSchedule[]; duration: number | null; onClose: () => void }) {
  const [index, setIndex] = useState(0); const [answer, setAnswer] = useState(''); const [outcome, setOutcome] = useState('correct'); const [confidence, setConfidence] = useState('none');
  const [revealed, setRevealed] = useState(false); const [submitted, setSubmitted] = useState(false); const [notes, setNotes] = useState(''); const [completed, setCompleted] = useState(0);
  const [request, setRequest] = useState(() => crypto.randomUUID()); const [error, setError] = useState('');
  const started = useRef(Date.now()); const sessionStarted = useRef(Date.now());
  const { save, saving } = usePreparationWrite(); const schedule = schedules[index];
  const question = useQuery({ queryKey: ['revision-question', schedule?.id, revealed || submitted], enabled: !!schedule,
    queryFn: async () => { const { data, error } = await supabase.rpc('spaced_revision_question', { _schedule_id: schedule.id, _reveal: revealed || submitted }); if (error) throw error; return data as unknown as RevisionQuestion; } });
  const submit = async () => {
    if (!schedule) return; setError('');
    try { await save(() => supabase.rpc('submit_spaced_revision', { _schedule_id: schedule.id, _request_id: request, _version: schedule.version, _selected: answer, _outcome: outcome, _confidence: confidence === 'none' ? undefined : confidence, _revealed: revealed, _seconds: Math.round((Date.now() - started.current) / 1000), _notes: notes || undefined })); setSubmitted(true); setCompleted(n => n + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this revision.'); }
  };
  const next = () => {
    if (index + 1 >= schedules.length || (duration !== null && Date.now() - sessionStarted.current >= duration * 60000)) { onClose(); return; }
    setIndex(n => n + 1); setAnswer(''); setOutcome('correct'); setConfidence('none'); setRevealed(false); setSubmitted(false); setNotes(''); setError(''); setRequest(crypto.randomUUID()); started.current = Date.now();
  };
  if (!schedule) return <p>No available questions in this session.</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Question {index + 1} / {schedules.length} · R{schedule.stage + 1}</span><span>Due {schedule.due_date} · {completed} saved</span></div>
    {question.isLoading && <p role="status">Loading question…</p>}
    {question.error && <div role="alert" className="space-y-2"><p>{question.error.message}</p><Button variant="outline" onClick={next}>Continue without recording</Button></div>}
    {question.data && <>
      <p className="text-xs text-muted-foreground">{question.data.subject} · {question.data.chapter} · {question.data.topic} · {question.data.source}</p>
      <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{question.data.text}</p>
      <p className="text-sm text-muted-foreground">Previous answer: {question.data.previous || 'Skipped / not recorded'}</p>
      <RadioGroup value={answer} onValueChange={setAnswer} disabled={submitted} className="space-y-2">{Object.entries(question.data.options).filter(([, text]) => text).map(([key, text]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"><RadioGroupItem value={key} className="mt-1 shrink-0" /><span className="min-w-0 whitespace-pre-wrap break-words">{key}. {text}</span></label>)}</RadioGroup>
      {!Object.values(question.data.options).some(Boolean) && <Field label="Your answer (optional for self-assessment)"><Input value={answer} onChange={e => setAnswer(e.target.value)} disabled={submitted} /></Field>}
      {!question.data.has_answer && <p className="text-sm text-warning">Correct answer is missing. Record an honest self-assessment; this is not automatically graded.</p>}
      {!submitted && <div className="grid gap-3 sm:grid-cols-2"><Field label="Outcome"><Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['correct', 'Correct without guessing'], ['guessed', 'Correct after guessing'], ['incorrect', 'Incorrect'], ['skipped', 'Skipped'], ['could_not_solve', 'Could not solve'], ['concept_not_understood', 'Concept not understood']].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field><Field label="Confidence (optional)"><Select value={confidence} onValueChange={setConfidence}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['none', 'low', 'medium', 'high'].map(v => <SelectItem key={v} value={v}>{v === 'none' ? 'Not recorded' : v}</SelectItem>)}</SelectContent></Select></Field><Field label="Notes"><Input value={notes} onChange={e => setNotes(e.target.value)} /></Field></div>}
      {(revealed || submitted) && <section className="space-y-2 border-t pt-3"><p className="font-semibold">Correct answer: {question.data.correct || 'Not provided'}</p><p className="whitespace-pre-wrap break-words text-sm">{question.data.explanation || 'Explanation not provided.'}</p>{revealed && <p className="text-xs text-muted-foreground">Revealed answers do not advance mastery.</p>}{submitted && <p className="text-sm text-success">Revision saved. The next date is updated.</p>}</section>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">{!submitted ? <><Button variant="outline" disabled={revealed || saving} onClick={() => setRevealed(true)}><Eye className="mr-2 h-4 w-4" />Reveal answer</Button><Button disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Submit revision'}</Button></> : <Button onClick={next}><ArrowRight className="mr-2 h-4 w-4" />{index + 1 === schedules.length ? 'Finish session' : 'Next question'}</Button>}</div>
    </>}
  </div>;
}