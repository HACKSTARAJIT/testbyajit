import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ClipboardPaste, Play, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { IMPORT_TEMPLATE, parseMockMistakes } from "@/lib/mockMistakes";

export default function MockMistakesMock() {
  const { subject = "", mockId = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mockName, setMockName] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPaste, setShowPaste] = useState(false);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const [{ data: mock }, { count }] = await Promise.all([
      supabase.from("mock_mistake_mocks").select("name").eq("id", mockId).maybeSingle(),
      supabase.from("mock_mistake_questions").select("id", { count: "exact", head: true }).eq("mock_id", mockId),
    ]);
    setMockName((mock as any)?.name ?? "Mock");
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, mockId]);

  const importQuestions = async () => {
    if (!user) return;
    const parsed = parseMockMistakes(text);
    if (parsed.length === 0) {
      toast({ title: "No questions found", description: "Please use the import format shown above.", variant: "destructive" });
      return;
    }
    setImporting(true);
    const rows = parsed.map((q, i) => ({ ...q, mock_id: mockId, user_id: user.id, sort_order: total + i }));
    const { error } = await supabase.from("mock_mistake_questions").insert(rows);
    setImporting(false);
    if (error) { toast({ title: "Import failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Successfully Imported: ${parsed.length} Questions` });
    setText("");
    setShowPaste(false);
    load();
  };

  const clearQuestions = async () => {
    const { error } = await supabase.from("mock_mistake_questions").delete().eq("mock_id", mockId);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    load();
  };

  if (loading) return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-24 rounded-2xl" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {subjectName}
      </Button>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <h1 className="font-display text-2xl font-bold">{mockName}</h1>
        <p className="mt-1 text-sm text-white/85">Total Questions Imported: {total}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" className="rounded-2xl" onClick={() => setShowPaste((v) => !v)}>
          <ClipboardPaste className="mr-1 h-4 w-4" /> Paste Questions
        </Button>
        <Button
          className="rounded-2xl"
          disabled={total === 0}
          onClick={() => navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}/${mockId}/test`)}
        >
          <Play className="mr-1 h-4 w-4" /> Start Mock Test
        </Button>
      </div>

      {showPaste && (
        <div className="glass-card space-y-3 rounded-3xl p-5">
          <div>
            <p className="text-sm font-semibold">Import Format</p>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs text-muted-foreground">
{IMPORT_TEMPLATE}
            </pre>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste all your questions here (10, 20, 50 or 100 together)..."
            className="min-h-[240px] rounded-2xl font-mono text-xs"
          />
          <Button className="w-full rounded-2xl" onClick={importQuestions} disabled={importing || !text.trim()}>
            {importing ? "Importing..." : "Import Questions"}
          </Button>
        </div>
      )}

      {total > 0 && (
        <Button variant="ghost" className="w-full rounded-2xl text-destructive" onClick={clearQuestions}>
          <Trash2 className="mr-1 h-4 w-4" /> Delete all imported questions
        </Button>
      )}
    </div>
  );
}
