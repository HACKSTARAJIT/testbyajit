import { supabase } from "@/integrations/supabase/client";

export type RevPriority = "high" | "medium" | "low";

export type SubjectSummary = {
  subject_id: string;
  name: string;
  name_hi: string | null;
  pending: number;
  tests: number;
  high: number;
  medium: number;
  low: number;
};

export type ChapterSummary = {
  chapter_id: string;
  name: string;
  name_hi: string | null;
  pending: number;
  tests: number;
};

export type RevisionTestRow = {
  id: string;
  test_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  title: string;
  question_ids: string[];
  question_count: number;
  updated_at: string;
};

export type MasteredRow = {
  id: string;
  question_id: string | null;
  question_text: string | null;
  correct_option: string | null;
  explanation: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  mastered_at: string | null;
};

type PendingRow = {
  subject_id: string | null;
  chapter_id: string | null;
  priority: RevPriority;
  question_id: string | null;
};

/** Subject cards for the Smart Revision home — only subjects with pending mistakes. */
export async function loadSubjectSummaries(userId: string): Promise<SubjectSummary[]> {
  const [{ data: pend }, { data: rtests }, { data: subs }] = await Promise.all([
    supabase
      .from("wrong_questions")
      .select("subject_id, priority, question_id")
      .eq("user_id", userId)
      .eq("status", "pending"),
    supabase.from("revision_tests").select("subject_id").eq("user_id", userId),
    supabase.from("subjects").select("id, name, name_hi").order("sort_order"),
  ]);

  const subMap = new Map<string, { name: string; name_hi: string | null }>();
  (subs ?? []).forEach((s: any) => subMap.set(s.id, { name: s.name, name_hi: s.name_hi }));

  const acc = new Map<string, SubjectSummary>();
  (pend as PendingRow[] | null ?? []).forEach((r) => {
    const sid = r.subject_id ?? "none";
    const meta = subMap.get(sid) ?? { name: "General", name_hi: null };
    const cur =
      acc.get(sid) ??
      { subject_id: sid, name: meta.name, name_hi: meta.name_hi, pending: 0, tests: 0, high: 0, medium: 0, low: 0 };
    cur.pending += 1;
    cur[r.priority] += 1;
    acc.set(sid, cur);
  });
  (rtests ?? []).forEach((r: any) => {
    const sid = r.subject_id ?? "none";
    const cur = acc.get(sid);
    if (cur) cur.tests += 1;
  });

  return [...acc.values()].sort((a, b) => b.pending - a.pending);
}

/** Chapters of a subject that still have pending mistakes. */
export async function loadChapterSummaries(userId: string, subjectId: string): Promise<ChapterSummary[]> {
  const realSubject = subjectId === "none" ? null : subjectId;
  const [{ data: pend }, { data: rtests }, { data: chaps }] = await Promise.all([
    supabase
      .from("wrong_questions")
      .select("chapter_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .filter("subject_id", realSubject ? "eq" : "is", realSubject as any),
    supabase
      .from("revision_tests")
      .select("chapter_id")
      .eq("user_id", userId)
      .filter("subject_id", realSubject ? "eq" : "is", realSubject as any),
    supabase.from("chapters").select("id, name, name_hi").order("name"),
  ]);

  const chapMap = new Map<string, { name: string; name_hi: string | null }>();
  (chaps ?? []).forEach((c: any) => chapMap.set(c.id, { name: c.name, name_hi: c.name_hi }));

  const acc = new Map<string, ChapterSummary>();
  (pend ?? []).forEach((r: any) => {
    const cid = r.chapter_id ?? "none";
    const meta = chapMap.get(cid) ?? { name: "General", name_hi: null };
    const cur = acc.get(cid) ?? { chapter_id: cid, name: meta.name, name_hi: meta.name_hi, pending: 0, tests: 0 };
    cur.pending += 1;
    acc.set(cid, cur);
  });
  (rtests ?? []).forEach((r: any) => {
    const cid = r.chapter_id ?? "none";
    const cur = acc.get(cid);
    if (cur) cur.tests += 1;
  });

  return [...acc.values()].sort((a, b) => b.pending - a.pending);
}

/** Auto-generated revision tests inside a chapter. */
export async function loadChapterRevisionTests(
  userId: string,
  subjectId: string,
  chapterId: string,
): Promise<RevisionTestRow[]> {
  const realSubject = subjectId === "none" ? null : subjectId;
  const realChapter = chapterId === "none" ? null : chapterId;
  let q = supabase
    .from("revision_tests")
    .select("id, test_id, subject_id, chapter_id, title, question_ids, question_count, updated_at")
    .eq("user_id", userId)
    .filter("subject_id", realSubject ? "eq" : "is", realSubject as any)
    .filter("chapter_id", realChapter ? "eq" : "is", realChapter as any)
    .order("updated_at", { ascending: false });
  const { data } = await q;
  return ((data as any[]) ?? []).map((r) => ({
    ...r,
    question_ids: (r.question_ids as string[]) ?? [],
  })) as RevisionTestRow[];
}

export type OverallStats = {
  totalEver: number;
  pending: number;
  mastered: number;
  high: number;
  medium: number;
  low: number;
  revisionTests: number;
  masteryPct: number;
  revisionAccuracy: number;
  masteredThisWeek: number;
  masteredThisMonth: number;
};

export async function loadOverallStats(userId: string): Promise<OverallStats> {
  const [{ data: rows }, { count: rtCount }] = await Promise.all([
    supabase
      .from("wrong_questions")
      .select("status, priority, wrong_count, correct_revision_count, mastered_at")
      .eq("user_id", userId),
    supabase.from("revision_tests").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const list = (rows as any[]) ?? [];
  const totalEver = list.length;
  const pending = list.filter((r) => r.status === "pending").length;
  const mastered = list.filter((r) => r.status === "mastered").length;
  const active = list.filter((r) => r.status !== "mastered");
  const high = active.filter((r) => r.priority === "high").length;
  const medium = active.filter((r) => r.priority === "medium").length;
  const low = active.filter((r) => r.priority === "low").length;

  const totalWrong = list.reduce((s, r) => s + (r.wrong_count ?? 0), 0);
  const totalCorrectRev = list.reduce((s, r) => s + (r.correct_revision_count ?? 0), 0);
  const denom = totalWrong + totalCorrectRev;
  const revisionAccuracy = denom > 0 ? Math.round((totalCorrectRev / denom) * 100) : 0;

  const now = Date.now();
  const week = 7 * 86400000;
  const month = 30 * 86400000;
  const masteredThisWeek = list.filter((r) => r.mastered_at && now - +new Date(r.mastered_at) <= week).length;
  const masteredThisMonth = list.filter((r) => r.mastered_at && now - +new Date(r.mastered_at) <= month).length;

  return {
    totalEver,
    pending,
    mastered,
    high,
    medium,
    low,
    revisionTests: rtCount ?? 0,
    masteryPct: totalEver > 0 ? Math.round((mastered / totalEver) * 100) : 0,
    revisionAccuracy,
    masteredThisWeek,
    masteredThisMonth,
  };
}

export async function loadMastered(userId: string): Promise<MasteredRow[]> {
  const { data } = await supabase
    .from("wrong_questions")
    .select("id, question_id, question_text, correct_option, explanation, subject_id, chapter_id, mastered_at")
    .eq("user_id", userId)
    .eq("status", "mastered")
    .order("mastered_at", { ascending: false });
  return (data as any[]) ?? [];
}

/** Random pending question ids across all subjects for a Quick Revision. */
export async function loadQuickRevisionIds(userId: string, limit: number): Promise<string[]> {
  const { data } = await supabase
    .from("wrong_questions")
    .select("question_id, priority")
    .eq("user_id", userId)
    .eq("status", "pending")
    .not("question_id", "is", null);
  const ids = [...new Set((data ?? []).map((r: any) => r.question_id).filter(Boolean))] as string[];
  // shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, limit);
}
