import { supabase } from "@/integrations/supabase/client";

export type SyllabusStatus = "not_started" | "in_progress" | "completed" | "paused" | "revision_pending";
export type SyllabusPriority = "high" | "medium" | "low";
export type ResourceType =
  | "video" | "pdf" | "note" | "practice_test"
  | "smart_revision" | "mock_hub" | "ai_performance" | "external";

export interface TopicResource {
  id: string;
  type: ResourceType;
  label: string;
  url: string;
}

export interface SyllabusSubject {
  id: string; user_id: string; name: string; icon: string | null; color: string | null;
  linked_subject_id: string | null; sort_order: number;
}
export interface SyllabusChapter {
  id: string; user_id: string; subject_id: string; name: string; sort_order: number;
}
export interface SyllabusTopic {
  id: string; user_id: string; subject_id: string; chapter_id: string;
  name: string; status: SyllabusStatus; priority: SyllabusPriority; notes: string | null;
  target_date: string | null;
  estimated_hours: number | null; estimated_classes: number | null;
  estimated_pages: number | null; estimated_revisions: number | null;
  revision_count: number; resources: TopicResource[]; sort_order: number;
  completed_at: string | null; last_activity_at: string | null;
  created_at: string; updated_at: string;
}

export const STATUS_META: Record<SyllabusStatus, { label: string; emoji: string; color: string }> = {
  not_started:      { label: "Not Started",      emoji: "⚪", color: "bg-muted text-muted-foreground" },
  in_progress:      { label: "In Progress",      emoji: "🔵", color: "bg-blue-500/20 text-blue-300" },
  completed:        { label: "Completed",        emoji: "✅", color: "bg-emerald-500/20 text-emerald-300" },
  paused:           { label: "Paused",           emoji: "⏸️", color: "bg-amber-500/20 text-amber-300" },
  revision_pending: { label: "Revision Pending", emoji: "🔁", color: "bg-fuchsia-500/20 text-fuchsia-300" },
};
export const PRIORITY_META: Record<SyllabusPriority, { label: string; color: string }> = {
  high:   { label: "High",   color: "bg-red-500/20 text-red-300" },
  medium: { label: "Medium", color: "bg-yellow-500/20 text-yellow-300" },
  low:    { label: "Low",    color: "bg-slate-500/20 text-slate-300" },
};
export const RESOURCE_META: Record<ResourceType, { label: string; emoji: string }> = {
  video:           { label: "Video Class",     emoji: "🎥" },
  pdf:             { label: "PDF",             emoji: "📄" },
  note:            { label: "Notes",           emoji: "📝" },
  practice_test:   { label: "Practice Test",   emoji: "🧪" },
  smart_revision:  { label: "Smart Revision",  emoji: "🔁" },
  mock_hub:        { label: "Mock Revision",   emoji: "🧠" },
  ai_performance:  { label: "AI Performance",  emoji: "📊" },
  external:        { label: "External",        emoji: "🔗" },
};

export interface SyllabusBundle {
  subjects: SyllabusSubject[];
  chapters: SyllabusChapter[];
  topics: SyllabusTopic[];
}

export async function fetchSyllabus(userId: string): Promise<SyllabusBundle> {
  const [s, c, t] = await Promise.all([
    supabase.from("syllabus_subjects").select("*").eq("user_id", userId).order("sort_order").order("created_at"),
    supabase.from("syllabus_chapters").select("*").eq("user_id", userId).order("sort_order").order("created_at"),
    supabase.from("syllabus_topics").select("*").eq("user_id", userId).order("sort_order").order("created_at"),
  ]);
  return {
    subjects: (s.data as any[]) ?? [],
    chapters: (c.data as any[]) ?? [],
    topics: ((t.data as any[]) ?? []).map((x) => ({ ...x, resources: Array.isArray(x.resources) ? x.resources : [] })),
  };
}

export function progressFor(topics: SyllabusTopic[]) {
  const total = topics.length;
  const completed = topics.filter((t) => t.status === "completed").length;
  const in_progress = topics.filter((t) => t.status === "in_progress").length;
  const revision = topics.filter((t) => t.status === "revision_pending").length;
  const paused = topics.filter((t) => t.status === "paused").length;
  const pending = total - completed;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, in_progress, revision, paused, pending, pct };
}

export async function logTimeline(userId: string, topic: SyllabusTopic, event_type: string, note?: string) {
  await supabase.from("syllabus_timeline").insert({
    user_id: userId, topic_id: topic.id, subject_id: topic.subject_id, chapter_id: topic.chapter_id,
    event_type, note: note ?? null,
  });
}

export async function updateTopicStatus(userId: string, topic: SyllabusTopic, status: SyllabusStatus) {
  const patch: any = { status, last_activity_at: new Date().toISOString() };
  if (status === "completed") { patch.completed_at = new Date().toISOString(); }
  if (status === "revision_pending") { patch.revision_count = (topic.revision_count ?? 0) + 1; }
  await supabase.from("syllabus_topics").update(patch).eq("id", topic.id);
  await logTimeline(userId, topic, `status:${status}`);
}

export function openAllResources(resources: TopicResource[]) {
  resources.forEach((r) => {
    if (!r.url) return;
    try { window.open(r.url, "_blank", "noopener"); } catch { /* ignore */ }
  });
}
