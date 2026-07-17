import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Target, TrendingUp, Brain, GraduationCap, BookOpen, Award, Timer, GitCompare, Sparkles, Loader2, AlertTriangle, CheckCircle2, Flame,
} from "lucide-react";
import { toast } from "sonner";

type Data = any;
const EXAMS = ["SSC CGL", "SSC CHSL", "SSC MTS", "Railway NTPC", "Railway Group D", "State PCS", "Bank PO", "Other"];

function SectionCard({ title, icon: Icon, gradient, children }: any) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-card/60 backdrop-blur">
      <CardHeader className={`bg-gradient-to-r ${gradient} py-3`}>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Icon className="h-5 w-5" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

function Stat({ label, value, suffix }: { label: string; value: any; suffix?: string }) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}{suffix}</p>
    </div>
  );
}

function TargetDialog({ current, onSaved }: { current: any; onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [exam, setExam] = useState(current?.exam_name ?? "SSC CGL");
  const [date, setDate] = useState<string>(current?.exam_date ?? "");
  const [score, setScore] = useState<string>(current?.target_score?.toString() ?? "85");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("user_exam_targets").upsert({
      user_id: user.id, exam_name: exam, exam_date: date || null, target_score: Number(score) || null,
    }, { onConflict: "user_id,exam_name" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Target saved");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Target className="mr-1 h-4 w-4" /> {current ? "Edit Target" : "Set Exam Target"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Set Selection Target</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Exam</Label>
            <Select value={exam} onValueChange={setExam}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXAMS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Exam Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div><Label>Target Score (%)</Label>
            <Input type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Target"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SelectionIntelligence() {
  const { user } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("selection-intelligence");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setData(res);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  if (loading) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
  if (!data) return <div className="p-6 text-muted-foreground">No data yet — attempt some tests first.</div>;

  const d: any = data;

  return (
    <div className="space-y-4 pb-24">
      {/* Hero */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 text-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
                🎯 Selection Intelligence
              </h1>
              <p className="mt-1 text-sm text-white/90">
                Namaste {d.firstName} — आपकी selection probability बढ़ाने के लिए complete AI intelligence
              </p>
            </div>
            <TargetDialog current={d.target} onSaved={load} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Overall Accuracy" value={d.overall.accuracy} suffix="%" />
            <Stat label="Readiness" value={d.overall.readiness} suffix="%" />
            <Stat label="Mocks" value={d.overall.mocks} />
            <Stat label="Pending Rev" value={d.overall.wrongPending} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="mentor" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-9">
          <TabsTrigger value="mentor" className="text-xs">Mentor</TabsTrigger>
          <TabsTrigger value="recovery" className="text-xs">Recovery</TabsTrigger>
          <TabsTrigger value="booster" className="text-xs">Booster</TabsTrigger>
          <TabsTrigger value="memory" className="text-xs">Memory</TabsTrigger>
          <TabsTrigger value="readiness" className="text-xs">Readiness</TabsTrigger>
          <TabsTrigger value="pyq" className="text-xs">PYQ</TabsTrigger>
          <TabsTrigger value="mastery" className="text-xs">Mastery</TabsTrigger>
          <TabsTrigger value="countdown" className="text-xs">Countdown</TabsTrigger>
          <TabsTrigger value="gap" className="text-xs">Gap</TabsTrigger>
        </TabsList>

        {/* 9. MENTOR */}
        <TabsContent value="mentor" className="mt-4">
          <SectionCard title="AI Personal Selection Mentor" icon={Sparkles} gradient="from-purple-600 to-pink-600">
            <p className="text-sm leading-relaxed">{d.mentor.summary}</p>
            <ul className="mt-3 space-y-2">
              {d.mentor.bullets.map((b: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {d.mentor.aiGenerated && (
              <Badge variant="secondary" className="mt-3">Powered by AJIT AI</Badge>
            )}
          </SectionCard>
        </TabsContent>

        {/* 1. WEAKNESS RECOVERY */}
        <TabsContent value="recovery" className="mt-4">
          <SectionCard title="Weakness Recovery Roadmap" icon={TrendingUp} gradient="from-rose-600 to-orange-600">
            {d.weaknessRecovery.length === 0 ? <p className="text-sm text-muted-foreground">कोई weak chapter नहीं मिला — great!</p> : (
              <div className="space-y-3">
                {d.weaknessRecovery.map((w: any) => (
                  <div key={w.id} className="rounded-xl border bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{w.label}</p>
                        <p className="text-xs text-muted-foreground">{w.subject}</p>
                      </div>
                      <Badge variant="destructive">+{w.expectedGain}% possible</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span>Current {w.currentAccuracy}%</span>
                      <Progress value={w.currentAccuracy} className="h-2 flex-1" />
                      <span>Target {w.targetAccuracy}%</span>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-primary">5-Day Recovery Plan</summary>
                      <ol className="mt-2 space-y-1 text-xs">
                        {w.plan.map((p: any) => (
                          <li key={p.day}><strong>Day {p.day} — {p.task}:</strong> {p.detail}</li>
                        ))}
                      </ol>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* 2. MARKS BOOSTER */}
        <TabsContent value="booster" className="mt-4">
          <SectionCard title={`Marks Booster (up to +${d.marksBooster.totalBoost} marks)`} icon={Flame} gradient="from-amber-500 to-red-600">
            {d.marksBooster.items.length === 0 ? <p className="text-sm text-muted-foreground">कोई gap नहीं मिला।</p> : (
              <div className="space-y-2">
                {d.marksBooster.items.map((it: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-3">
                    <div>
                      <p className="text-sm font-semibold">{it.action}</p>
                      <p className="text-xs text-muted-foreground">{it.why}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-500">+{it.gain}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">{it.effort}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* 3. MEMORY */}
        <TabsContent value="memory" className="mt-4 space-y-3">
          <SectionCard title={`Memory Strength: ${d.memory.strength}%`} icon={Brain} gradient="from-indigo-600 to-blue-600">
            <Progress value={d.memory.strength} className="h-3" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-red-500"><AlertTriangle className="h-4 w-4" /> Forgotten ({d.memory.forgotten.length})</p>
                {d.memory.forgotten.map((m: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1"><span>{m.label}</span><span className="text-red-500">{m.retention}%</span></div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-amber-500">At Risk ({d.memory.atRisk.length})</p>
                {d.memory.atRisk.map((m: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1"><span>{m.label}</span><span className="text-amber-500">{m.retention}%</span></div>
                ))}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* 4. READINESS PER EXAM */}
        <TabsContent value="readiness" className="mt-4">
          <SectionCard title="Exam Readiness Predictor" icon={GraduationCap} gradient="from-emerald-600 to-teal-600">
            <div className="space-y-3">
              {d.readinessByExam.map((r: any) => (
                <div key={r.exam} className="rounded-xl border bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{r.exam}</p>
                    <Badge variant={r.readiness >= 70 ? "default" : r.readiness >= 50 ? "secondary" : "destructive"}>{r.readiness}%</Badge>
                  </div>
                  <Progress value={r.readiness} className="mt-2 h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">Confidence: {r.confidence}%</p>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {r.reasons.map((x: string, i: number) => <li key={i}>• {x}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* 5. PYQ */}
        <TabsContent value="pyq" className="mt-4">
          <SectionCard title="PYQ Coverage Tracker" icon={BookOpen} gradient="from-cyan-600 to-blue-600">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Subject Coverage" value={d.pyq.subjectCoverage} suffix="%" />
              <Stat label="Chapter Coverage" value={d.pyq.chapterCoverage} suffix="%" />
              <Stat label="Total PYQs Uploaded" value={d.pyq.totalPYQ} />
            </div>
            <p className="mt-4 text-sm font-semibold">Uncovered Chapters</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {d.pyq.remainingChapters.length === 0
                ? <p className="text-xs text-muted-foreground">All chapters covered!</p>
                : d.pyq.remainingChapters.map((c: any) => (
                  <Badge key={c.id} variant="outline">{c.label}</Badge>
                ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* 6. MASTERY */}
        <TabsContent value="mastery" className="mt-4">
          <SectionCard title="Concept Mastery" icon={Award} gradient="from-violet-600 to-fuchsia-600">
            <div className="space-y-2">
              {d.mastery.map((m: any) => (
                <div key={m.subject} className="rounded-xl border bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{m.subject}</p>
                    <Badge>{m.category}</Badge>
                  </div>
                  <Progress value={m.mastery} className="mt-2 h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">{m.mastery}% mastery</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* 7. COUNTDOWN */}
        <TabsContent value="countdown" className="mt-4">
          <SectionCard title="Selection Countdown" icon={Timer} gradient="from-red-600 to-orange-500">
            {!d.countdown ? (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">कोई exam target set नहीं है।</p>
                <div className="mt-3 flex justify-center"><TargetDialog current={d.target} onSaved={load} /></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{d.countdown.exam} • {d.countdown.examDate}</p>
                  <p className="text-5xl font-black text-primary">{d.countdown.daysRemaining}</p>
                  <p className="text-xs text-muted-foreground">days remaining</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Chapters Left" value={d.countdown.chaptersRemaining} />
                  <Stat label="Revisions Left" value={d.countdown.revisionRemaining} />
                  <Stat label="Mocks Left" value={d.countdown.mocksRemaining} />
                </div>
                <div className="rounded-xl border bg-background/60 p-3 text-sm">
                  <p><strong>Daily Target:</strong> {d.countdown.dailyTarget}</p>
                  <p><strong>Weekly Target:</strong> {d.countdown.weeklyTarget}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Expected completion: {d.countdown.expectedCompletion}</p>
                </div>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* 8. GAP ANALYZER */}
        <TabsContent value="gap" className="mt-4">
          <SectionCard title="Selection Gap Analyzer" icon={GitCompare} gradient="from-slate-700 to-slate-900">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Current" value={d.gapAnalyzer.currentAvg} suffix="%" />
              <Stat label="Target" value={d.gapAnalyzer.targetScore} suffix="%" />
              <Stat label="Gap" value={d.gapAnalyzer.gap} suffix="%" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Estimated recovery: ~{d.gapAnalyzer.estimatedRecoveryDays} days of focused effort
            </p>
            <p className="mt-4 mb-2 text-sm font-semibold">Subject Gaps</p>
            {d.gapAnalyzer.subjectGaps.map((s: any) => (
              <div key={s.label} className="mb-2">
                <div className="flex justify-between text-xs"><span>{s.label}</span><span className="text-muted-foreground">{s.current}% → {s.target}%</span></div>
                <Progress value={s.current} className="h-1.5" />
              </div>
            ))}
            <p className="mt-4 mb-2 text-sm font-semibold">Chapter Gaps</p>
            {d.gapAnalyzer.chapterGaps.map((c: any) => (
              <div key={c.label} className="mb-2">
                <div className="flex justify-between text-xs"><span>{c.label}</span><span className="text-muted-foreground">Gap {c.gap}%</span></div>
                <Progress value={c.current} className="h-1.5" />
              </div>
            ))}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
