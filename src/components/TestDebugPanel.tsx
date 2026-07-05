import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadTestWithQuestions } from "@/lib/testLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface DebugResult {
  testId: string;
  published: boolean | null;
  totalInDb: number | null;
  countError: string | null;
  returnedByStudentQuery: number;
  testError: string | null;
  questionsError: string | null;
}

export function TestDebugPanel({ tests }: { tests: any[] }) {
  const [testId, setTestId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);

  const run = async () => {
    if (!testId) return;
    setRunning(true);
    // Exact count straight from the database
    const { count, error: cErr } = await supabase
      .from("questions").select("id", { count: "exact", head: true }).eq("test_id", testId);
    // The EXACT same loader the Student Test page uses
    const loaded = await loadTestWithQuestions(testId);
    setResult({
      testId,
      published: loaded.test?.is_published ?? null,
      totalInDb: count ?? null,
      countError: cErr?.message ?? null,
      returnedByStudentQuery: loaded.questions.length,
      testError: loaded.testError,
      questionsError: loaded.questionsError,
    });
    setRunning(false);
  };

  const ok = result && !result.testError && !result.questionsError && !result.countError
    && result.totalInDb === result.returnedByStudentQuery && (result.totalInDb ?? 0) > 0;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bug className="h-4 w-4 text-secondary" /> Test Debug Panel (temporary)
        </CardTitle>
        <p className="text-xs text-muted-foreground">Runs the exact same query students use, so you can verify any test loads correctly.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={testId} onValueChange={setTestId}>
            <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Select a test to check" /></SelectTrigger>
            <SelectContent>
              {tests.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.subjects?.name ? `${t.subjects.name} — ` : ""}{t.title}{t.test_part ? ` (${t.test_part})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={run} disabled={!testId || running}>
            {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Bug className="mr-1 h-4 w-4" />} Run Check
          </Button>
        </div>

        {result && (
          <div className="space-y-2 rounded-xl border bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
              {ok ? "Students can load this test correctly" : "Problem detected"}
            </div>
            <Field label="Test ID" value={result.testId} mono />
            <Field label="Published Status" value={result.published === null ? "test not found" : result.published ? "Published" : "NOT published"} />
            <Field label="Total Questions in Database" value={result.countError ? `ERROR: ${result.countError}` : String(result.totalInDb ?? 0)} />
            <Field label="Questions Returned by Student Query" value={String(result.returnedByStudentQuery)} />
            <Field label="Test Query Error" value={result.testError ?? "none"} />
            <Field label="Questions Query Error" value={result.questionsError ?? "none"} />
            {!ok && (result.totalInDb ?? 0) === 0 && !result.questionsError && (
              <Badge variant="destructive">This test has 0 questions saved in the database — re-publish it from the AI Test Generator.</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>{value}</span>
    </div>
  );
}
