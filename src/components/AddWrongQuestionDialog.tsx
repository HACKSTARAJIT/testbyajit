import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadFile } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookMarked, Upload } from "lucide-react";
import { toast } from "sonner";

export type WrongQuestionTarget = {
  test_id?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  title?: string;
};

export function AddWrongQuestionDialog({
  target, onSaved, triggerClassName, triggerVariant = "outline", triggerLabel = "Add Wrong Question",
}: {
  target: WrongQuestionTarget;
  onSaved?: () => void;
  triggerClassName?: string;
  triggerVariant?: "outline" | "secondary" | "default" | "ghost";
  triggerLabel?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [explanation, setExplanation] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFile(null); setNote(""); setExplanation(""); setPriority("medium");
  };

  const save = async () => {
    if (!user) return toast.error("Please log in to save");
    if (!file) return toast.error("Upload a screenshot of the question");
    setSaving(true);
    try {
      const path = await uploadFile(file, `wrong-questions/${user.id}`);
      const { error } = await supabase.from("wrong_questions").insert({
        user_id: user.id,
        test_id: target.test_id ?? null,
        subject_id: target.subject_id ?? null,
        chapter_id: target.chapter_id ?? null,
        image_path: path,
        note: note || null,
        explanation: explanation || null,
        priority,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Saved to Wrong Questions Notebook!");
      reset();
      setOpen(false);
      onSaved?.();
    } catch (e) {
      toast.error("Could not save question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className={triggerClassName}>
          <BookMarked className="mr-1 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Wrong Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {target.title && <p className="text-sm text-muted-foreground">{target.title}</p>}

          <div className="space-y-1">
            <Label className="text-xs">Screenshot</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && (
              <img src={URL.createObjectURL(file)} alt="preview" className="mt-2 max-h-48 rounded-md border object-contain" />
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">🔴 High Priority</SelectItem>
                <SelectItem value="medium">🟠 Medium Priority</SelectItem>
                <SelectItem value="low">🟢 Low Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why did you get it wrong?" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Explanation (optional)</Label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Correct answer / explanation" />
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            <Upload className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save Question"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
