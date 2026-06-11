import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ExternalLink, History, Save, Trophy, Clock, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { AddWrongQuestionDialog } from "@/components/AddWrongQuestionDialog";

export type Attempt = {
  id: string;
  test_id: string;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  marks_obtained: number;
  created_at: string;
};

export function attemptStats(attempts: Attempt[]) {
  if (attempts.length === 0) return { last: null as number | null, best: null as number | null, count: 0 };
  const sorted = [...attempts].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return {
    last: Number(sorted[0].marks_obtained),
    best: Math.max(...attempts.map((a) => Number(a.marks_obtained))),
    count: attempts.length,
  };
}

export function TestTracker({
  test, attempts, onSaved, triggerClassName,
}: {
  test: { id: string; title: string; test_link: string };
  attempts: Attempt[];
  onSaved: () => void;
  triggerClassName?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [correct, setCorrect] = useState("");
  const [incorrect, setIncorrect] = useState("");
  const [unattempted, setUnattempted] = useState("");
  const [marks, setMarks] = useState("");
  const [saving, setSaving] = useState(false);

  const stats = attemptStats(attempts);
  const history = [...attempts].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  const startTest = () => window.open(test.test_link, "_blank", "noopener,noreferrer");

  const save = async () => {
    if (!user) return toast.error("Please log in to save results");
    if (marks === "") return toast.error("Enter the marks obtained");
    setSaving(true);
    const { error } = await supabase.from("test_attempts").insert({
      user_id: user.id,
      test_id: test.id,
      correct_count: Number(correct) || 0,
      incorrect_count: Number(incorrect) || 0,
      unattempted_count: Number(unattempted) || 0,
      marks_obtained: Number(marks) || 0,
    });
    setSaving(false);
    if (error) return toast.error("Could not save result");
    toast.success("Result saved!");
    setCorrect(""); setIncorrect(""); setUnattempted(""); setMarks("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>Open Tracker & Start Test</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Test Instructions & Result Tracker</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm font-medium">{test.title}</p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat icon={Clock} label="Last Score" value={stats.last ?? "—"} />
            <Stat icon={Trophy} label="Best Score" value={stats.best ?? "—"} />
            <Stat icon={ListChecks} label="Attempts" value={stats.count} />
          </div>

          <ul className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <li>• This test will open on an external website.</li>
            <li>• Complete the test there.</li>
            <li>• Return here after completion.</li>
            <li>• Enter your result below.</li>
            <li>• Your complete test history will be saved.</li>
          </ul>

          <Button onClick={startTest} variant="secondary" className="w-full">
            <ExternalLink className="mr-1 h-4 w-4" /> Start Test
          </Button>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-semibold">Enter Your Result</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Correct Questions" value={correct} onChange={setCorrect} />
              <Field label="Incorrect Questions" value={incorrect} onChange={setIncorrect} />
              <Field label="Unattempted Questions" value={unattempted} onChange={setUnattempted} />
              <Field label="Marks Obtained" value={marks} onChange={setMarks} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save Result"}
            </Button>
          </div>

          {history.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <History className="h-4 w-4" /> Test History
              </p>
              <div className="space-y-1.5">
                {history.map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Attempt {i + 1}</span>
                    <span className="font-medium">{Number(a.marks_obtained)} Marks</span>
                    <span className="text-xs text-muted-foreground">
                      {a.correct_count}✓ / {a.incorrect_count}✗
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-lg border p-2">
      <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
      <p className="text-base font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
