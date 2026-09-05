import { supabase } from "@/integrations/supabase/client";

/* ────────────────────────────────────────────────────────────
   Study Time module — independent of every other app module.
   Canonical numeric value is always duration_seconds.
   ──────────────────────────────────────────────────────────── */

export type StudyEntry = {
  id: string;
  user_id: string;
  study_date: string;           // YYYY-MM-DD
  subject_id: string | null;
  subject_name: string;
  normalized_key: string;
  duration_seconds: number;
  source: string;
  source_reference: string | null;
  needs_confirmation: boolean;
  notes: string | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StudySubject = {
  id: string;
  user_id: string;
  name: string;
  normalized_key: string;
  aliases: string[];
  sort_order: number;
  is_active: boolean;
};

export type StudyGoals = {
  daily_goal_seconds: number | null;
  weekly_goal_seconds: number | null;
  monthly_goal_seconds: number | null;
};

export type ImportBatch = {
  id: string;
  import_number: number;
  study_date: string | null;
  entry_count: number;
  total_seconds: number;
  source: string;
  created_at: string;
};

/* ── Formatting ───────────────────────────────────────────── */

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function formatShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function splitDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds || 0));
  return { hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

export function toSeconds(hours: number, minutes: number, seconds: number) {
  return Math.max(0, (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0));
}

/** Parse "3:18:46", "40:49", "3h 18m 46s", "45m" → seconds. Returns null if unreadable. */
export function parseDuration(text: string | null | undefined): number | null {
  if (!text) return null;
  const raw = String(text).trim().toLowerCase();
  if (!raw) return null;

  const colon = raw.match(/^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (colon) {
    const a = Number(colon[1]), b = Number(colon[2]), c = colon[3] !== undefined ? Number(colon[3]) : null;
    return c === null ? a * 60 + b : a * 3600 + b * 60 + c;
  }

  const hms = raw.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    return toSeconds(Number(hms[1] || 0), Number(hms[2] || 0), Number(hms[3] || 0));
  }
  return null;
}

/* ── Dates ────────────────────────────────────────────────── */

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const monthKey = (iso: string) => iso.slice(0, 7);

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export function prettyMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/* ── Subject normalization ────────────────────────────────── */

const CANONICAL: Array<{ name: string; aliases: string[] }> = [
  { name: "MATHEMATICS", aliases: ["math", "maths", "mathematics", "mathmatics", "maths practice", "quant", "quants", "quantitative aptitude", "gnit"] },
  { name: "ENGLISH READING", aliases: ["english reading", "reading", "eng reading", "reading comprehension", "rc"] },
  { name: "ENGLISH", aliases: ["english", "eng", "english language", "english grammar"] },
  { name: "GENERAL AWARENESS", aliases: ["general awareness", "ga", "gk", "general knowledge", "gs", "general studies"] },
  { name: "REASONING", aliases: ["reasoning", "logical reasoning", "reason", "lr"] },
  { name: "VOCABULARY", aliases: ["vocab", "vocabulary", "words", "word power"] },
  { name: "CURRENT AFFAIRS", aliases: ["current affairs", "ca", "currentaffairs", "daily current affairs"] },
  { name: "COMPUTER", aliases: ["computer", "computer awareness", "computer knowledge"] },
  { name: "SCIENCE", aliases: ["science", "general science"] },
  { name: "HINDI", aliases: ["hindi", "hindi language"] },
];

const cleanText = (s: string) =>
  String(s || "")
    .replace(/[_\-–—]+/g, " ")
    .replace(/[^\p{L}\p{N}\s&]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Map any raw subject text to a canonical display name + stable key. */
export function normalizeSubject(
  raw: string,
  custom: StudySubject[] = [],
): { name: string; key: string } {
  const cleaned = cleanText(raw);
  const lower = cleaned.toLowerCase();
  if (!lower) return { name: "UNKNOWN", key: "unknown" };

  for (const s of custom) {
    if (s.normalized_key === lower) return { name: s.name, key: s.normalized_key };
    if ((s.aliases || []).some((a) => cleanText(a).toLowerCase() === lower)) {
      return { name: s.name, key: s.normalized_key };
    }
  }
  for (const c of CANONICAL) {
    if (c.aliases.includes(lower)) return { name: c.name, key: cleanText(c.name).toLowerCase() };
  }
  return { name: cleaned.toUpperCase(), key: lower };
}

export const CANONICAL_SUBJECT_NAMES = CANONICAL.map((c) => c.name);

/* ── Reads ────────────────────────────────────────────────── */

export async function loadSubjects(userId: string): Promise<StudySubject[]> {
  const { data } = await supabase
    .from("study_time_subjects")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order")
    .order("name");
  return (data ?? []) as StudySubject[];
}

export async function loadEntries(userId: string, opts?: { from?: string; to?: string }): Promise<StudyEntry[]> {
  let q = supabase.from("study_time_entries").select("*").eq("user_id", userId);
  if (opts?.from) q = q.gte("study_date", opts.from);
  if (opts?.to) q = q.lte("study_date", opts.to);
  const { data, error } = await q.order("study_date", { ascending: false }).order("duration_seconds", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudyEntry[];
}

export async function loadGoals(userId: string): Promise<StudyGoals> {
  const { data } = await supabase
    .from("study_time_goals")
    .select("daily_goal_seconds, weekly_goal_seconds, monthly_goal_seconds")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    daily_goal_seconds: data?.daily_goal_seconds ?? null,
    weekly_goal_seconds: data?.weekly_goal_seconds ?? null,
    monthly_goal_seconds: data?.monthly_goal_seconds ?? null,
  };
}

export async function saveGoals(userId: string, goals: StudyGoals) {
  const { error } = await supabase
    .from("study_time_goals")
    .upsert({ user_id: userId, ...goals }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function loadImports(userId: string): Promise<ImportBatch[]> {
  const { data } = await supabase
    .from("study_time_imports")
    .select("id, import_number, study_date, entry_count, total_seconds, source, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as ImportBatch[];
}

/* ── Writes ───────────────────────────────────────────────── */

async function ensureSubject(userId: string, name: string, key: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("study_time_subjects")
    .select("id")
    .eq("user_id", userId)
    .eq("normalized_key", key)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data } = await supabase
    .from("study_time_subjects")
    .insert({ user_id: userId, name, normalized_key: key })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

export type DraftEntry = {
  subject: string;
  duration_seconds: number | null;   // null = needs confirmation
  raw?: string | null;
};

export type DuplicateInfo = { existing: StudyEntry; draft: DraftEntry };

/** Find drafts that already exist (same date + subject + duration). */
export async function findDuplicates(userId: string, date: string, drafts: DraftEntry[], subjects: StudySubject[]) {
  const { data } = await supabase
    .from("study_time_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("study_date", date);
  const existing = (data ?? []) as StudyEntry[];
  const dupes: DuplicateInfo[] = [];
  for (const d of drafts) {
    const { key } = normalizeSubject(d.subject, subjects);
    const hit = existing.find((e) => e.normalized_key === key);
    if (hit) dupes.push({ existing: hit, draft: d });
  }
  return dupes;
}

export type SaveMode = "add" | "replace" | "skip-existing";

export async function saveEntries(
  userId: string,
  date: string,
  drafts: DraftEntry[],
  opts: { source: string; sourceReference?: string | null; mode?: SaveMode; createBatch?: boolean; raw?: unknown },
) {
  const subjects = await loadSubjects(userId);
  const mode: SaveMode = opts.mode ?? "add";

  const { data: existingRows } = await supabase
    .from("study_time_entries")
    .select("id, normalized_key")
    .eq("user_id", userId)
    .eq("study_date", date);
  const existingByKey = new Map((existingRows ?? []).map((r: any) => [r.normalized_key, r.id as string]));

  let batchId: string | null = null;
  if (opts.createBatch) {
    const { data: last } = await supabase
      .from("study_time_imports")
      .select("import_number")
      .eq("user_id", userId)
      .order("import_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (last?.import_number ?? 0) + 1;
    const { data: batch, error } = await supabase
      .from("study_time_imports")
      .insert({
        user_id: userId,
        import_number: nextNumber,
        study_date: date,
        source: opts.source,
        source_reference: opts.sourceReference ?? null,
        raw_extraction: (opts.raw ?? null) as any,
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    batchId = batch?.id ?? null;
  }

  let saved = 0;
  let totalSeconds = 0;

  for (const draft of drafts) {
    const { name, key } = normalizeSubject(draft.subject, subjects);
    const subjectId = await ensureSubject(userId, name, key);
    const seconds = draft.duration_seconds ?? 0;
    const payload = {
      user_id: userId,
      study_date: date,
      subject_id: subjectId,
      subject_name: name,
      normalized_key: key,
      duration_seconds: seconds,
      source: opts.source,
      source_reference: opts.sourceReference ?? null,
      needs_confirmation: draft.duration_seconds === null,
      import_batch_id: batchId,
    };

    const existingId = existingByKey.get(key);
    if (existingId && mode === "skip-existing") continue;
    if (existingId && mode === "replace") {
      const { error } = await supabase.from("study_time_entries").update(payload).eq("id", existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("study_time_entries").insert(payload);
      if (error) throw error;
    }
    saved += 1;
    totalSeconds += seconds;
  }

  if (batchId) {
    await supabase
      .from("study_time_imports")
      .update({ entry_count: saved, total_seconds: totalSeconds })
      .eq("id", batchId);
  }

  return { saved, totalSeconds, batchId };
}

export async function updateEntry(
  entryId: string,
  patch: { study_date?: string; subject?: string; duration_seconds?: number },
  userId: string,
) {
  const update: Record<string, unknown> = {};
  if (patch.study_date) update.study_date = patch.study_date;
  if (typeof patch.duration_seconds === "number") {
    update.duration_seconds = Math.max(0, Math.round(patch.duration_seconds));
    update.needs_confirmation = false;
  }
  if (patch.subject) {
    const subjects = await loadSubjects(userId);
    const { name, key } = normalizeSubject(patch.subject, subjects);
    update.subject_name = name;
    update.normalized_key = key;
    update.subject_id = await ensureSubject(userId, name, key);
  }
  const { error } = await supabase.from("study_time_entries").update(update).eq("id", entryId).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteEntry(entryId: string, userId: string) {
  const { error } = await supabase.from("study_time_entries").delete().eq("id", entryId).eq("user_id", userId);
  if (error) throw error;
}

export async function renameSubject(userId: string, subject: StudySubject, newName: string) {
  const name = cleanText(newName).toUpperCase();
  if (!name) throw new Error("Subject name cannot be empty.");
  const key = name.toLowerCase();
  const { error } = await supabase
    .from("study_time_subjects")
    .update({ name, normalized_key: key })
    .eq("id", subject.id)
    .eq("user_id", userId);
  if (error) throw error;
  await supabase
    .from("study_time_entries")
    .update({ subject_name: name, normalized_key: key })
    .eq("user_id", userId)
    .eq("subject_id", subject.id);
}

export async function addSubjectAlias(userId: string, subject: StudySubject, alias: string) {
  const a = cleanText(alias).toLowerCase();
  if (!a) return;
  const aliases = Array.from(new Set([...(subject.aliases || []), a]));
  const { error } = await supabase
    .from("study_time_subjects")
    .update({ aliases })
    .eq("id", subject.id)
    .eq("user_id", userId);
  if (error) throw error;
}

/* ── Aggregations (all from duration_seconds) ─────────────── */

export function totalsByDate(entries: StudyEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.study_date, (m.get(e.study_date) ?? 0) + e.duration_seconds);
  return m;
}

export function totalsBySubject(entries: StudyEntry[]): Array<{ key: string; name: string; seconds: number }> {
  const m = new Map<string, { key: string; name: string; seconds: number }>();
  for (const e of entries) {
    const cur = m.get(e.normalized_key) ?? { key: e.normalized_key, name: e.subject_name, seconds: 0 };
    cur.seconds += e.duration_seconds;
    m.set(e.normalized_key, cur);
  }
  return [...m.values()].sort((a, b) => b.seconds - a.seconds);
}

export function totalsByMonth(entries: StudyEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const k = monthKey(e.study_date);
    m.set(k, (m.get(k) ?? 0) + e.duration_seconds);
  }
  return m;
}

export function subjectMonthMatrix(entries: StudyEntry[]) {
  const months = [...new Set(entries.map((e) => monthKey(e.study_date)))].sort();
  const rows = new Map<string, { name: string; byMonth: Record<string, number>; total: number }>();
  for (const e of entries) {
    const row = rows.get(e.normalized_key) ?? { name: e.subject_name, byMonth: {}, total: 0 };
    const k = monthKey(e.study_date);
    row.byMonth[k] = (row.byMonth[k] ?? 0) + e.duration_seconds;
    row.total += e.duration_seconds;
    rows.set(e.normalized_key, row);
  }
  return { months, rows: [...rows.values()].sort((a, b) => b.total - a.total) };
}

export function streaks(entries: StudyEntry[]): { current: number; longest: number } {
  const days = [...totalsByDate(entries).entries()].filter(([, s]) => s > 0).map(([d]) => d).sort();
  if (days.length === 0) return { current: 0, longest: 0 };
  const set = new Set(days);

  let longest = 0, run = 0;
  let prev: Date | null = null;
  for (const d of days) {
    const cur = new Date(d + "T00:00:00");
    run = prev && Math.round((cur.getTime() - prev.getTime()) / 864e5) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = cur;
  }

  let current = 0;
  const cursor = new Date(todayISO() + "T00:00:00");
  if (!set.has(isoOf(cursor))) cursor.setDate(cursor.getDate() - 1); // today not yet studied → check from yesterday
  while (set.has(isoOf(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, longest };
}

export function monthlySummary(entries: StudyEntry[], key: string) {
  const inMonth = entries.filter((e) => monthKey(e.study_date) === key);
  const byDate = [...totalsByDate(inMonth).entries()].filter(([, s]) => s > 0);
  const total = inMonth.reduce((s, e) => s + e.duration_seconds, 0);
  const daysStudied = byDate.length;
  const sorted = byDate.slice().sort((a, b) => b[1] - a[1]);
  const subjects = totalsBySubject(inMonth);
  return {
    total,
    daysStudied,
    average: daysStudied ? Math.round(total / daysStudied) : 0,
    bestDay: sorted[0] ?? null,
    worstDay: sorted[sorted.length - 1] ?? null,
    topSubject: subjects[0] ?? null,
    subjects,
    entries: inMonth,
  };
}

export function rangeFor(preset: string): { from: string | null; to: string | null } {
  const now = new Date();
  const t = todayISO();
  switch (preset) {
    case "today":
      return { from: t, to: t };
    case "week": {
      const d = new Date(now);
      const day = (d.getDay() + 6) % 7; // Monday start
      d.setDate(d.getDate() - day);
      return { from: isoOf(d), to: t };
    }
    case "month":
      return { from: `${t.slice(0, 7)}-01`, to: t };
    case "last-month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: isoOf(d), to: isoOf(end) };
    }
    default:
      return { from: null, to: null };
  }
}
