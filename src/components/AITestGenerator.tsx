import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, Trash2, Plus, Upload, FileText, CheckCircle2, AlertTriangle, ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import { parseMCQs, type ParsedQuestion } from "@/lib/mcqParser";
import { extractTextFromFile } from "@/lib/extractText";
import { TestEngine, type EngineQuestion } from "@/components/TestEngine";

const LETTERS = ["A", "B", "C", "D"] as const;
const EXAMPLE = `1. What is the capital of India?
A. Mumbai
B. Delhi
C. Chennai
D. Kolkata
Answer: B

2. Which planet is known as the Red Planet?
A. Earth
B. Venus
C. Mars
D. Jupiter
Answer: C`;

export function AITestGenerator({ subjects, chapters, reload }: any) {
  const [step, setStep] = useState<"input" | "preview">("input");
  const [rawText, setRawText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // config
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [testName, setTestName] = useState("");
  const [testPart, setTestPart] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [timeLimit, setTimeLimit] = useState("30");

  const subjChapters = chapters.filter((c: any) => c.subject_id === subjectId);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setExtracting(true);
    try {
      const text = await extractTextFromFile(file);
      setRawText(text);
      toast.success("File loaded. Now click Detect Questions.");
    } catch (e: any) {
      toast.error(e.message || "Could not read file");
    } finally {
      setExtracting(false);
    }
  };

  const detect = () => {
    if (!rawText.trim()) return toast.error("Paste or upload MCQ text first");
    const parsed = parseMCQs(rawText);
    if (parsed.length === 0) return toast.error("No questions detected. Check the format.");
    setQuestions(parsed);
    if (!totalMarks) setTotalMarks(String(parsed.length));
    setStep("preview");
    toast.success(`${parsed.length} question(s) detected`);
  };

  const update = (i: number, field: keyof ParsedQuestion, value: string) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, [field]: value } : q)));

  const removeQ = (i: number) => setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  const addQ = () =>
    setQuestions((prev) => [
      ...prev,
      { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A", explanation: "" },
    ]);

  const missing = useMemo(
    () => questions.filter((q) => !q.question.trim() || !q.correct_option || !q.option_a || !q.option_b).length,
    [questions]
  );

  const publish = async () => {
    if (!subjectId) return toast.error("Select a subject");
    if (!testName.trim()) return toast.error("Enter a test name");
    if (questions.length === 0) return toast.error("No questions to publish");
    const bad = questions.filter((q) => !q.question.trim() || !q.correct_option || !q.option_a || !q.option_b);
    if (bad.length > 0) return toast.error(`${bad.length} question(s) missing text/options/answer. Fix them first.`);

    setPublishing(true);
    try {
      const marks = Number(totalMarks) || questions.length;
      const perQ = Math.max(1, Math.round(marks / questions.length));
      const { data: test, error: tErr } = await supabase
        .from("tests")
        .insert({
          subject_id: subjectId,
          chapter_id: chapterId || null,
          title: testName.trim(),
          test_part: testPart.trim() || null,
          duration_minutes: Number(timeLimit) || 30,
          total_marks: marks,
          total_questions: questions.length,
          is_published: true,
        } as any)
        .select("id")
        .single();
      if (tErr) throw tErr;

      const rows = questions.map((q, idx) => ({
        test_id: test.id,
        question_text: q.question.trim(),
        option_a: q.option_a.trim(),
        option_b: q.option_b.trim(),
        option_c: q.option_c.trim() || "-",
        option_d: q.option_d.trim() || "-",
        correct_option: q.correct_option,
        explanation: q.explanation?.trim() || null,
        marks: perQ,
        sort_order: idx,
      }));

      // insert in batches to support very large imports (1000+)
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from("questions").insert(rows.slice(i, i + BATCH) as any);
        if (error) throw error;
      }

      // verify the published test actually contains all questions
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("test_id", test.id);
      if ((count ?? 0) !== questions.length) {
        throw new Error(`Verification failed: saved ${count ?? 0}/${questions.length} questions. Please retry.`);
      }

      toast.success(`Test "${testName}" published & verified with ${count} questions!`);
      // reset
      setStep("input"); setRawText(""); setQuestions([]);
      setTestName(""); setTestPart(""); setTotalMarks(""); setChapterId("");
      reload?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  if (step === "preview") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-secondary" /> Preview & Edit — {questions.length} Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Subject *</Label>
                <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chapter</Label>
                <Select value={chapterId} onValueChange={setChapterId}>
                  <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                  <SelectContent>{subjChapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Test Name *</Label><Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. Geography Mock 1" /></div>
              <div><Label>Test Part</Label><Input value={testPart} onChange={(e) => setTestPart(e.target.value)} placeholder="e.g. Part 1" /></div>
              <div><Label>Total Marks</Label><Input type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} /></div>
              <div><Label>Time Limit (minutes)</Label><Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">Total Questions: {questions.length}</Badge>
              {missing > 0 ? (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {missing} need review</Badge>
              ) : (
                <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> All complete</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {questions.map((q, i) => {
            const incomplete = !q.question.trim() || !q.correct_option || !q.option_a || !q.option_b;
            return (
              <Card key={i} className={incomplete ? "border-destructive/50" : ""}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-1 shrink-0">Q{i + 1}</Badge>
                    <Textarea className="flex-1" value={q.question} onChange={(e) => update(i, "question", e.target.value)} placeholder="Question text" />
                    <Button size="icon" variant="ghost" onClick={() => removeQ(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {LETTERS.map((L) => {
                      const field = `option_${L.toLowerCase()}` as keyof ParsedQuestion;
                      const selected = q.correct_option === L;
                      return (
                        <div key={L} className="flex items-center gap-2">
                          <Button
                            type="button" size="sm"
                            variant={selected ? "default" : "outline"}
                            className="w-9 shrink-0"
                            onClick={() => update(i, "correct_option", L)}
                            title="Mark correct"
                          >{L}</Button>
                          <Input value={q[field] as string} onChange={(e) => update(i, field, e.target.value)} placeholder={`Option ${L}`} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="shrink-0 text-xs text-muted-foreground">Correct: {q.correct_option || "—"}</Label>
                    <Input value={q.explanation} onChange={(e) => update(i, "explanation", e.target.value)} placeholder="Explanation (optional)" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background/95 py-3 backdrop-blur">
          <Button variant="outline" onClick={() => setStep("input")}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
          <Button variant="outline" onClick={addQ}><Plus className="mr-1 h-4 w-4" /> Add Question</Button>
          <Button onClick={publish} disabled={publishing} className="ml-auto">
            {publishing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />} Publish Test
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-secondary" /> AI Test Generator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste or upload MCQs and generate a complete online test automatically. Supports TXT, DOCX & PDF, and very large imports (100–1000+ questions).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <label>
            <input type="file" accept=".txt,.docx,.pdf" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            <Button asChild variant="outline" disabled={extracting}>
              <span>{extracting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />} Upload TXT / DOCX / PDF</span>
            </Button>
          </label>
          <Button variant="ghost" onClick={() => setRawText(EXAMPLE)}><FileText className="mr-1 h-4 w-4" /> Load example</Button>
        </div>

        <div>
          <Label>Paste MCQ Text</Label>
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={EXAMPLE}
            className="min-h-[280px] font-mono text-sm"
          />
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium">Expected format:</p>
          <pre className="mt-1 whitespace-pre-wrap">{`Question text?
A. Option
B. Option
C. Option
D. Option
Answer: B
Explanation: (optional)`}</pre>
        </div>

        <Button onClick={detect} className="w-full">
          <Sparkles className="mr-1 h-4 w-4" /> Detect Questions & Preview
        </Button>
      </CardContent>
    </Card>
  );
}
