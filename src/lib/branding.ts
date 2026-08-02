import { supabase } from "@/integrations/supabase/client";

export const BRANDING_BUCKET = "branding";

/** Future-ready: add a category here and the whole system picks it up. */
export const FEEDBACK_CATEGORIES = [
  { key: "correct", label: "Correct Answer", emoji: "✅" },
  { key: "wrong", label: "Wrong Answer", emoji: "❌" },
  { key: "perfect", label: "Perfect Score", emoji: "🏆" },
  { key: "improvement", label: "Improvement", emoji: "📈" },
  { key: "completion", label: "Test Completion", emoji: "🎉" },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["key"] | string;
export type FeedbackMediaType = "voice" | "animation";

export type AppIntroRow = {
  id: string;
  file_path: string | null;
  media_kind: string;
  mime_type: string | null;
  enabled: boolean;
  duration_seconds: number;
  skip_enabled: boolean;
};

export type FeedbackSettingsRow = {
  id: string;
  voice_enabled: boolean;
  animation_enabled: boolean;
  volume: number;
  animation_duration_ms: number;
  random_playback: boolean;
  category_flags: Record<string, boolean>;
};

export type FeedbackMediaRow = {
  id: string;
  category: string;
  media_type: FeedbackMediaType;
  file_path: string;
  mime_type: string | null;
  label: string | null;
  enabled: boolean;
};

const urlCache = new Map<string, string>();

/** Signed URL (1 day) with in-memory cache so playback is instant after first load. */
export async function brandingUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const hit = urlCache.get(path);
  if (hit) return hit;
  const { data } = await supabase.storage.from(BRANDING_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (!data?.signedUrl) return null;
  urlCache.set(path, data.signedUrl);
  return data.signedUrl;
}

export async function uploadBranding(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeBranding(path?: string | null) {
  if (!path) return;
  urlCache.delete(path);
  await supabase.storage.from(BRANDING_BUCKET).remove([path]);
}

export function detectKind(file: File): "video" | "gif" | "lottie" | "audio" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json") || name.endsWith(".lottie")) return "lottie";
  if (name.endsWith(".gif") || name.endsWith(".webp")) return "gif";
  if (file.type.startsWith("audio/")) return "audio";
  return "video";
}

export function kindOfPath(path: string): "video" | "gif" | "lottie" | "audio" {
  const p = path.toLowerCase();
  if (p.endsWith(".json") || p.endsWith(".lottie")) return "lottie";
  if (p.endsWith(".gif") || p.endsWith(".webp") || p.endsWith(".png")) return "gif";
  if (/\.(mp3|wav|ogg|m4a|aac|weba)$/.test(p)) return "audio";
  return "video";
}

export async function loadIntro(): Promise<AppIntroRow | null> {
  const { data } = await supabase
    .from("app_intro")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AppIntroRow) ?? null;
}

export async function loadFeedbackSettings(): Promise<FeedbackSettingsRow | null> {
  const { data } = await supabase
    .from("feedback_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any as FeedbackSettingsRow) ?? null;
}

export async function loadFeedbackMedia(): Promise<FeedbackMediaRow[]> {
  const { data } = await supabase.from("feedback_media").select("*").order("created_at");
  return ((data as any) ?? []) as FeedbackMediaRow[];
}

export type FeedbackBundle = {
  settings: FeedbackSettingsRow | null;
  media: FeedbackMediaRow[];
};

export async function loadFeedbackBundle(): Promise<FeedbackBundle> {
  const [settings, media] = await Promise.all([loadFeedbackSettings(), loadFeedbackMedia()]);
  return { settings, media };
}

export function categoryEnabled(settings: FeedbackSettingsRow | null, category: string) {
  if (!settings) return false;
  const flag = settings.category_flags?.[category];
  return flag !== false;
}

export function pick<T>(items: T[], random: boolean): T | null {
  if (items.length === 0) return null;
  return random ? items[Math.floor(Math.random() * items.length)] : items[0];
}
