import { supabase } from "@/integrations/supabase/client";

export type CommandFilter = {
  onlyGuess?: boolean;
  onlyMarked?: boolean;
  onlyCritical?: boolean;
  onlyRepeated?: boolean; // wrong 2+ times
  onlyFinalMode?: boolean; // critical + high + never-mastered
  subjectId?: string | null;
  chapterId?: string | null;
  priority?: "critical" | "high" | "medium" | "low";
  dueTodayOnly?: boolean;
};

export type CommandStats = {
  pending: number;
  mastered: number;
  critical: number;
  dueToday: number;
  subjectsPending: number;
  topicsPending: number;
  guessBank: number;
  markedBank: number;
  repeatedMistakes: number;
};

/** Rich stats for the Command Center dashboard. */
export async function loadCommandStats(userId: string): Promise<CommandStats> {
  const { data } = await supabase
    .from("wrong_questions")
    .select("status, priority, subject_id, chapter_id, topic, wrong_count, is_guess, is_marked, last_attempt_at")
    .eq("user_id", userId);

  const rows = (data as any[]) ?? [];
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const subjects = new Set<string>();
  const topics = new Set<string>();
  let pending = 0, mastered = 0, critical = 0, dueToday = 0;
  let guessBank = 0, markedBank = 0, repeatedMistakes = 0;

  for (const r of rows) {
    if (r.status === "mastered") { mastered += 1; continue; }
    pending += 1;
    if (r.priority === "critical") critical += 1;
    if (r.is_guess) guessBank += 1;
    if (r.is_marked) markedBank += 1;
    if ((r.wrong_count ?? 0) >= 2) repeatedMistakes += 1;
    if (r.subject_id) subjects.add(r.subject_id);
    if (r.chapter_id) topics.add(`${r.subject_id}:${r.chapter_id}:${r.topic ?? ""}`);
    // Due today = never attempted in the last 24h, or critical.
    const last = r.last_attempt_at ? +new Date(r.last_attempt_at) : 0;
    if (r.priority === "critical" || now - last > dayMs) dueToday += 1;
  }

  return {
    pending, mastered, critical, dueToday,
    subjectsPending: subjects.size,
    topicsPending: topics.size,
    guessBank, markedBank, repeatedMistakes,
  };
}

/** Filtered set of pending question ids for a Command Center revision session. */
export async function loadFilteredRevisionIds(
  userId: string,
  filter: CommandFilter,
  limit = 50,
): Promise<string[]> {
  let q = supabase
    .from("wrong_questions")
    .select("question_id, priority, wrong_count, last_attempt_at, is_guess, is_marked, consecutive_correct")
    .eq("user_id", userId)
    .eq("status", "pending")
    .not("question_id", "is", null);

  if (filter.subjectId) q = q.eq("subject_id", filter.subjectId);
  if (filter.chapterId) q = q.eq("chapter_id", filter.chapterId);
  if (filter.priority) q = q.eq("priority", filter.priority);
  if (filter.onlyGuess) q = q.eq("is_guess", true);
  if (filter.onlyMarked) q = q.eq("is_marked", true);
  if (filter.onlyCritical) q = q.eq("priority", "critical");
  if (filter.onlyRepeated) q = q.gte("wrong_count", 2);

  const { data } = await q;
  let rows = (data as any[]) ?? [];

  if (filter.onlyFinalMode) {
    rows = rows.filter((r) =>
      r.priority === "critical" ||
      r.priority === "high" ||
      (r.wrong_count ?? 0) >= 2 ||
      (r.consecutive_correct ?? 0) === 0,
    );
  }
  if (filter.dueTodayOnly) {
    const dayMs = 24 * 3600 * 1000;
    const now = Date.now();
    rows = rows.filter((r) => !r.last_attempt_at || now - +new Date(r.last_attempt_at) > dayMs);
  }

  // Priority weight ordering: critical > high > medium > low.
  const w: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  rows.sort((a, b) => (w[a.priority] ?? 9) - (w[b.priority] ?? 9));
  const ids = [...new Set(rows.map((r) => r.question_id).filter(Boolean))] as string[];
  return ids.slice(0, limit);
}
