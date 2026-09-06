import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, PencilLine, Loader2, Trash2, Plus, AlertTriangle, ArrowLeft, Save,
} from "lucide-react";
import {
  DraftEntry, StudySubject, findDuplicates, formatClock, normalizeSubject, parseDuration,
  prettyDate, saveEntries, splitDuration, todayISO, toSeconds, formatDuration,
} from "@/lib/studyTime";

type Step = "choose" | "screenshot" | "review" | "manual" | "duplicates";

type Row = { subject: string; hours: string; minutes: string; seconds: string; unknown: boolean };

const emptyRow = (): Row => ({ subject: "", hours: "0", minutes: "0", seconds: "0", unknown: false });

function rowSeconds(r: Row): number | null {
  if (r.unknown) return null;
  return toSeconds(Number(r.hours), Number(r.minutes), Number(r.seconds));
}

export default function AddStudyTimeDialog({
  open, onOpenChange, userId, subjects, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  subjects: StudySubject[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [dateConfirmed, setDateConfirmed] = useState(true);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [source, setSource] = useState<"manual" | "screenshot">("manual");
  const [sourceRef, setSourceRef] = useState<string | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [dupes, setDupes] = useState<Array<{ name: string; existing: number; incoming: number }>>([]);

  const reset = () => {
    setStep("choose"); setBusy(false); setError(null);
    setDate(todayISO()); setDateConfirmed(true); setRows([emptyRow()]);
    setSource("manual"); setSourceRef(null); setRaw(null); setDupes([]);
  };

  const close = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  async function handleFile(file: File) {
    setBusy(true); setError(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("Could not read the image file."));
        fr.readAsDataURL(file);
      });

      const { data, error: fnError } = await supabase.functions.invoke("extract-study-time", {
        body: { image: dataUrl },
      });
      if (fnError) throw new Error(fnError.message || "Screenshot could not be read.");
      if ((data as any)?.error) throw new Error((data as any).error);

      const extracted = (data as any).rows as Array<{ subject: string; duration: string | null; confident: boolean }>;
      const next: Row[] = extracted.map((r) => {
        const secs = parseDuration(r.duration);
        const parts = splitDuration(secs ?? 0);
        return {
          subject: normalizeSubject(r.subject, subjects).name,
          hours: String(parts.hours),
          minutes: String(parts.minutes),
          seconds: String(parts.seconds),
          unknown: secs === null,
        };
      });

      const foundDate = (data as any).date as string | null;
      const confident = (data as any).date_confidence === "high" && !!foundDate;
      setDate(confident ? foundDate! : todayISO());
      setDateConfirmed(confident);
      setRows(next.length ? next : [emptyRow()]);
      setSource("screenshot");
      setSourceRef(file.name);
      setRaw(data);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screenshot could not be read.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const validRows = (): DraftEntry[] =>
    rows
      .filter((r) => r.subject.trim().length > 0)
      .map((r) => ({ subject: r.subject.trim(), duration_seconds: rowSeconds(r) }));

  async function proceedToSave() {
    const drafts = validRows();
    if (drafts.length === 0) { setError("Add at least one subject."); return; }
    setBusy(true); setError(null);
    try {
      const found = await findDuplicates(userId, date, drafts, subjects);
      if (found.length > 0) {
        setDupes(found.map((d) => ({
          name: d.existing.subject_name,
          existing: d.existing.duration_seconds,
          incoming: d.draft.duration_seconds ?? 0,
        })));
        setStep("duplicates");
        setBusy(false);
        return;
      }
      await commit("add");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  async function commit(mode: "add" | "replace" | "skip-existing") {
    setBusy(true); setError(null);
    try {
      const drafts = validRows();
      const res = await saveEntries(userId, date, drafts, {
        source,
        sourceReference: sourceRef,
        mode,
        createBatch: source === "screenshot",
        raw,
      });
      toast({
        title: "Study time saved",
        description: `${res.saved} ${res.saved === 1 ? "entry" : "entries"} · ${formatDuration(res.totalSeconds)} on ${prettyDate(date)}`,
      });
      onSaved();
      close(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const totalPreview = rows.reduce((s, r) => s + (rowSeconds(r) ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== "choose" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep(step === "duplicates" ? "review" : "choose")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === "choose" && "Add Today's Study Time"}
            {step === "screenshot" && "Import Screenshot"}
            {step === "review" && "Study Time Found"}
            {step === "manual" && "Add Manually"}
            {step === "duplicates" && "Possible duplicate found"}
          </DialogTitle>
          <DialogDescription>
            {step === "choose" && "Import a screenshot of your study timer, or type it in yourself."}
            {step === "review" && "Check everything before saving. Nothing is saved until you confirm."}
            {step === "duplicates" && "These subjects already have an entry on this date."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "choose" && (
          <div className="grid gap-3">
            <Button size="lg" className="h-16 justify-start gap-3" onClick={() => setStep("screenshot")}>
              <Camera className="h-5 w-5" />
              <span className="text-left">
                <span className="block font-semibold">Import Screenshot</span>
                <span className="block text-xs opacity-80">AI reads subjects &amp; durations</span>
              </span>
            </Button>
            <Button size="lg" variant="outline" className="h-16 justify-start gap-3" onClick={() => { setSource("manual"); setRows([emptyRow()]); setStep("manual"); }}>
              <PencilLine className="h-5 w-5" />
              <span className="text-left">
                <span className="block font-semibold">Add Manually</span>
                <span className="block text-xs text-muted-foreground">Date, subject and duration</span>
              </span>
            </Button>
          </div>
        )}

        {step === "screenshot" && (
          <div className="grid gap-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button size="lg" className="h-24 flex-col gap-2" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
              {busy ? "Reading your screenshot…" : "Choose screenshot"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Only subject rows with a timer are extracted. Status bar, buttons and other app text are ignored.
              Nothing is saved until you confirm.
            </p>
          </div>
        )}

        {(step === "review" || step === "manual") && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="study-date">Date</Label>
              <Input id="study-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
              {!dateConfirmed && (
                <p className="text-xs text-amber-500">
                  The date was not clearly visible in the screenshot — please confirm it.
                </p>
              )}
            </div>

            <div className="grid gap-3">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border bg-card/60 p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={r.subject}
                      placeholder="Subject"
                      onChange={(e) => setRow(i, { subject: e.target.value })}
                      className="h-11"
                    />
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} aria-label="Remove row">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["hours", "minutes", "seconds"] as const).map((unit) => (
                      <div key={unit} className="grid gap-1">
                        <Label className="text-[11px] uppercase text-muted-foreground">{unit}</Label>
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={r[unit]}
                          onChange={(e) => setRow(i, { [unit]: e.target.value, unknown: false } as Partial<Row>)}
                          className="h-11"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatClock(rowSeconds(r) ?? 0)}</span>
                    {r.unknown && <Badge variant="destructive" className="text-[10px]">Needs confirmation</Badge>}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => setRows((p) => [...p, emptyRow()])}>
                <Plus className="h-4 w-4" /> Add another subject
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatDuration(totalPreview)}</span>
            </div>

            <Button size="lg" className="h-12 gap-2" disabled={busy} onClick={proceedToSave}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Study Time
            </Button>
          </div>
        )}

        {step === "duplicates" && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              {dupes.map((d) => (
                <div key={d.name} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Existing: {formatDuration(d.existing)} · New: {formatDuration(d.incoming)}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <Button variant="outline" className="h-11" disabled={busy} onClick={() => commit("skip-existing")}>Keep Existing</Button>
              <Button className="h-11" disabled={busy} onClick={() => commit("replace")}>Replace</Button>
              <Button variant="secondary" className="h-11" disabled={busy} onClick={() => commit("add")}>Add Anyway</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
