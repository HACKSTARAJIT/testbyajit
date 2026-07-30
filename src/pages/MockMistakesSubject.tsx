import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, ChevronRight, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type MockRow = { id: string; name: string; created_at: string };

export default function MockMistakesSubject() {
  const { subject = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("mock_mistake_mocks")
      .select("id, name, created_at")
      .eq("user_id", user.id)
      .eq("subject", subjectName)
      .order("created_at", { ascending: false });
    const rows = (data as MockRow[]) ?? [];
    setMocks(rows);
    if (rows.length) {
      const { data: qs } = await supabase
        .from("mock_mistake_questions")
        .select("mock_id")
        .in("mock_id", rows.map((r) => r.id));
      const acc: Record<string, number> = {};
      (qs ?? []).forEach((q: any) => { acc[q.mock_id] = (acc[q.mock_id] ?? 0) + 1; });
      setCounts(acc);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, subjectName]);

  const createMock = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("mock_mistake_mocks")
      .insert({ user_id: user.id, subject: subjectName, name: name.trim() })
      .select("id")
      .single();
    setSaving(false);
    if (error) { toast({ title: "Could not create mock", description: error.message, variant: "destructive" }); return; }
    setOpen(false);
    setName("");
    navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}/${data.id}`);
  };

  const removeMock = async (id: string) => {
    const { error } = await supabase.from("mock_mistake_mocks").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setMocks((m) => m.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/mock-mistakes")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Mock Mistakes
      </Button>

      <div className="rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <h1 className="font-display text-2xl font-bold">{subjectName}</h1>
        <p className="text-sm text-white/85">Your mocks in this subject</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full rounded-2xl"><Plus className="mr-1 h-4 w-4" /> Create New Mock</Button>
        </DialogTrigger>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Create New Mock</DialogTitle></DialogHeader>
          <Input
            placeholder="Mock Name (e.g. SSC CGL Mock 01)"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={createMock} disabled={saving || !name.trim()} className="w-full rounded-xl">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : mocks.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-muted-foreground">
          <FileText className="mx-auto h-10 w-10" />
          <p className="mt-3 font-semibold">No mocks yet</p>
          <p className="mt-1 text-sm">Create your first mock to start saving mistakes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mocks.map((m) => (
            <div key={m.id} className="glass-card flex items-center gap-3 rounded-2xl p-4">
              <button
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => navigate(`/mock-mistakes/${encodeURIComponent(subjectName)}/${m.id}`)}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{counts[m.id] ?? 0} questions</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              <Button variant="ghost" size="icon" onClick={() => removeMock(m.id)} aria-label="Delete mock">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
