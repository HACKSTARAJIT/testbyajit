import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, Upload, Eye, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import {
  brandingUrl, detectKind, kindOfPath, loadIntro, removeBranding, uploadBranding,
  type AppIntroRow,
} from "@/lib/branding";
import { LottiePlayer } from "@/components/LottiePlayer";

/** Detect whether a video file actually carries an audio track (best-effort, browser APIs). */
async function hasAudioTrack(file: File): Promise<boolean | null> {
  if (!file.type.startsWith("video/")) return null;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<boolean | null>((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.src = url;
      const done = (r: boolean | null) => resolve(r);
      v.onerror = () => done(null);
      v.onloadeddata = () => {
        const anyV = v as any;
        if (typeof anyV.mozHasAudio === "boolean") return done(anyV.mozHasAudio);
        if (typeof anyV.webkitAudioDecodedByteCount === "number")
          return done(anyV.webkitAudioDecodedByteCount > 0);
        if (anyV.audioTracks) return done(anyV.audioTracks.length > 0);
        done(null);
      };
      window.setTimeout(() => done(null), 8000);
      v.play().catch(() => {});
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AppIntroTab() {
  const [row, setRow] = useState<AppIntroRow | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [skip, setSkip] = useState(true);
  const [duration, setDuration] = useState("4");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  const load = async () => {
    const r = await loadIntro();
    setRow(r);
    if (r) {
      setEnabled(r.enabled);
      setSkip(r.skip_enabled);
      setDuration(String(r.duration_seconds ?? 4));
      setPreviewUrl(await brandingUrl(r.file_path));
    }
  };
  useEffect(() => { load(); }, []);

  const onPickFile = async (f: File | null) => {
    setFile(f);
    setAudioNote(null);
    if (!f) return;
    const has = await hasAudioTrack(f);
    if (has === false) setAudioNote("इस वीडियो में ऑडियो ट्रैक उपलब्ध नहीं है।");
  };


  const save = async () => {
    setBusy(true);
    try {
      let file_path = row?.file_path ?? null;
      let media_kind = row?.media_kind ?? "video";
      let mime_type = row?.mime_type ?? null;
      if (file) {
        if (row?.file_path) await removeBranding(row.file_path);
        file_path = await uploadBranding(file, "intro");
        media_kind = detectKind(file);
        mime_type = file.type || null;
      }
      const payload = {
        file_path, media_kind, mime_type,
        enabled, skip_enabled: skip,
        duration_seconds: Number(duration) || 4,
      } as any;
      const { error } = row
        ? await supabase.from("app_intro").update(payload).eq("id", row.id)
        : await supabase.from("app_intro").insert(payload);
      if (error) throw error;
      toast.success("Intro settings saved");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeIntro = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await removeBranding(row.file_path);
      const { error } = await supabase.from("app_intro").update({ file_path: null } as any).eq("id", row.id);
      if (error) throw error;
      setPreviewUrl(null);
      toast.success("Intro video deleted");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const kind = row?.file_path ? kindOfPath(row.file_path) : null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">🎬 App Intro</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Plays once each time the app is launched. Supported: MP4, WEBM, GIF, WEBP, Lottie (.json).
          If no file is uploaded, the app opens instantly with no intro.
        </p>

        <div>
          <Label>Intro file</Label>
          <Input ref={inputRef} type="file" accept="video/mp4,video/webm,image/gif,image/webp,application/json,.json"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
          {audioNote && <p className="mt-1 text-xs text-destructive">{audioNote}</p>}
          {row?.file_path && <p className="mt-1 text-xs text-muted-foreground">Current: {row.file_path.split("/").pop()} ({kind})</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <Label htmlFor="intro-enabled">Enable intro</Label>
            <Switch id="intro-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <Label htmlFor="intro-skip">Allow skip button</Label>
            <Switch id="intro-skip" checked={skip} onCheckedChange={setSkip} />
          </div>
        </div>

        <div>
          <Label>Intro duration (seconds)</Label>
          <Input type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" disabled={!previewUrl} onClick={() => setShowPreview((v) => !v)}>
            <Eye className="mr-2 h-4 w-4" /> {showPreview ? "Hide preview" : "Preview"}
          </Button>
          <Button variant="destructive" disabled={!row?.file_path || busy} onClick={removeIntro}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete intro
          </Button>
        </div>

        {showPreview && previewUrl && (
          <div className="space-y-2 overflow-hidden rounded-2xl border bg-muted/30 p-3">
            {kind === "lottie" ? <LottiePlayer src={previewUrl} className="mx-auto h-56" />
              : kind === "gif" ? <img src={previewUrl} alt="Intro preview" className="mx-auto max-h-64" />
              : (
                <>
                  <video
                    ref={previewRef}
                    src={previewUrl}
                    controls
                    autoPlay
                    muted={previewMuted}
                    playsInline
                    className="mx-auto max-h-64"
                  />
                  <div className="flex justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const v = previewRef.current;
                        const next = !previewMuted;
                        setPreviewMuted(next);
                        if (v) { v.muted = next; if (!next) { v.volume = 1; v.play().catch(() => {}); } }
                      }}
                    >
                      {previewMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
                      {previewMuted ? "🔇 Sound Off" : "🔊 Sound On"}
                    </Button>
                  </div>
                </>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
