import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import {
  FEEDBACK_CATEGORIES, brandingUrl, categoryEnabled, kindOfPath, loadFeedbackMedia,
  loadFeedbackSettings, removeBranding, uploadBranding,
  type FeedbackMediaRow, type FeedbackSettingsRow,
} from "@/lib/branding";
import { LottiePlayer } from "@/components/LottiePlayer";

export function VoiceFeedbackTab() {
  const [settings, setSettings] = useState<FeedbackSettingsRow | null>(null);
  const [media, setMedia] = useState<FeedbackMediaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; kind: string } | null>(null);

  const load = async () => {
    const [s, m] = await Promise.all([loadFeedbackSettings(), loadFeedbackMedia()]);
    setSettings(s);
    setMedia(m);
  };
  useEffect(() => { load(); }, []);

  const patch = async (values: Partial<FeedbackSettingsRow>) => {
    setBusy(true);
    try {
      if (settings) {
        const { error } = await supabase.from("feedback_settings").update(values as any).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feedback_settings").insert(values as any);
        if (error) throw error;
      }
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (category: string, type: "voice" | "animation", file: File) => {
    setBusy(true);
    try {
      const path = await uploadBranding(file, `feedback/${type}/${category}`);
      const { error } = await supabase.from("feedback_media").insert({
        category, media_type: type, file_path: path, mime_type: file.type || null, label: file.name,
      } as any);
      if (error) throw error;
      if (!settings) await patch({});
      toast.success("Uploaded");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (row: FeedbackMediaRow) => {
    setBusy(true);
    try {
      await removeBranding(row.file_path);
      const { error } = await supabase.from("feedback_media").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Deleted");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = async (row: FeedbackMediaRow, enabled: boolean) => {
    await supabase.from("feedback_media").update({ enabled } as any).eq("id", row.id);
    await load();
  };

  const previewItem = async (row: FeedbackMediaRow) => {
    const url = await brandingUrl(row.file_path);
    if (!url) return;
    if (row.media_type === "voice") {
      const a = new Audio(url);
      a.volume = Math.min(Math.max(Number(settings?.volume ?? 0.8), 0), 1);
      a.play().catch(() => {});
      return;
    }
    setPreview({ url, kind: kindOfPath(row.file_path) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">🎙️ Voice & Animation Feedback</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Practice Mode only. Multiple clips per category are supported — one is picked at random.
            Wrong-answer animations show only on the first wrong answer of a test.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label>Voice enabled</Label>
              <Switch checked={settings?.voice_enabled ?? true} disabled={busy}
                onCheckedChange={(v) => patch({ voice_enabled: v })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label>Animation enabled</Label>
              <Switch checked={settings?.animation_enabled ?? true} disabled={busy}
                onCheckedChange={(v) => patch({ animation_enabled: v })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label>Random playback</Label>
              <Switch checked={settings?.random_playback ?? true} disabled={busy}
                onCheckedChange={(v) => patch({ random_playback: v })} />
            </div>
            <div className="rounded-xl border p-3">
              <Label>Voice volume ({Math.round((settings?.volume ?? 0.8) * 100)}%)</Label>
              <Input type="range" min={0} max={1} step={0.05} value={settings?.volume ?? 0.8}
                onChange={(e) => patch({ volume: Number(e.target.value) })} />
            </div>
            <div className="rounded-xl border p-3 sm:col-span-2">
              <Label>Animation duration (ms)</Label>
              <Input type="number" min={400} step={100} value={settings?.animation_duration_ms ?? 2000}
                onChange={(e) => patch({ animation_duration_ms: Number(e.target.value) || 2000 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {FEEDBACK_CATEGORIES.map((cat) => {
        const voices = media.filter((m) => m.category === cat.key && m.media_type === "voice");
        const anims = media.filter((m) => m.category === cat.key && m.media_type === "animation");
        return (
          <Card key={cat.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{cat.emoji} {cat.label}</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Enabled</Label>
                <Switch
                  checked={categoryEnabled(settings, cat.key)}
                  disabled={busy}
                  onCheckedChange={(v) =>
                    patch({ category_flags: { ...(settings?.category_flags ?? {}), [cat.key]: v } as any })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <MediaSection
                title="Voice clips" accept="audio/*" items={voices}
                onUpload={(f) => upload(cat.key, "voice", f)}
                onDelete={removeItem} onToggle={toggleItem} onPreview={previewItem} busy={busy}
              />
              <MediaSection
                title="Animation / GIF" accept="image/gif,image/webp,video/mp4,application/json,.json" items={anims}
                onUpload={(f) => upload(cat.key, "animation", f)}
                onDelete={removeItem} onToggle={toggleItem} onPreview={previewItem} busy={busy}
              />
            </CardContent>
          </Card>
        );
      })}

      {preview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}>
          {preview.kind === "lottie" ? <LottiePlayer src={preview.url} className="h-64 w-64" />
            : preview.kind === "video" ? <video src={preview.url} autoPlay muted playsInline className="max-h-[70vh]" />
            : <img src={preview.url} alt="" className="max-h-[70vh]" />}
        </div>
      )}
    </div>
  );
}

function MediaSection({
  title, accept, items, onUpload, onDelete, onToggle, onPreview, busy,
}: {
  title: string;
  accept: string;
  items: FeedbackMediaRow[];
  onUpload: (f: File) => void;
  onDelete: (row: FeedbackMediaRow) => void;
  onToggle: (row: FeedbackMediaRow, v: boolean) => void;
  onPreview: (row: FeedbackMediaRow) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm">{title}</Label>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <Input type="file" accept={accept} disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing uploaded — this stays silent / hidden.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-xl border p-2 text-xs">
              <span className="flex-1 truncate">{m.label ?? m.file_path.split("/").pop()}</span>
              <Switch checked={m.enabled} onCheckedChange={(v) => onToggle(m, v)} />
              <Button size="icon" variant="ghost" onClick={() => onPreview(m)}><Play className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => onDelete(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </li>
          ))}
        </ul>
      )}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
