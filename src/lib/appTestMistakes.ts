import { supabase } from "@/integrations/supabase/client";
import type { PracticeQuestion } from "@/lib/revisionPractice";

/**
 * ❌ APP TEST MISTAKES — structured revision library.
 *
 * Source of truth: public.wrong_questions where source_type = 'app_test'.
 * Hierarchy: SUBJECT → CHAPTER → TEST → QUESTION.
 * Mastery: 2 correct answers during App Test Mistakes practice ⇒ mastered
 * (is_active = false) and the question leaves the active lists — history kept.
 *
 * This module NEVER touches mock_mistake_* tables.
 */

export const APP_TEST_MASTERY_TARGET = 2;

const NONE = "none";
const idFilter = (value: string) => (value === NONE ? null : value);

export type SubjectNode = {
  subject_id: string;
  name: string;
  name_hi: string | null;
  active: number;
  mastered: number;
  chapters: number;
};

export type ChapterNode = {
  chapter_id: string;
  name: string;
  name_hi: string | null;
  active: number;
  tests: number;
};

export type TestNode = {
  test_id: string;
  title: string;
  active: number;
};

export type MistakeQuestion = {
  id: string;
  question_id: string | null;
  question_text: string | null;
  selected_option: string | null;
  correct_option: string | null;
  explanation: string | null;
  topic: string | null;
  sub_topic: string | null;
  practice_correct_count: number;
  practice_attempts: number;
  mastery_status: "active" | "mastered";
  is_active: boolean;
  last_practiced_at: string | null;
  mastered_at: string | null;
  is_skipped: boolean;
  source: string | null;
};

const BASE_COLUMNS =
  "id, question_id, test_id, test_name, subject_id, chapter_id, question_text, selected_option, correct_option, explanation, topic, sub_topic, practice_correct_count, practice_attempts, mastery_status, is_active, last_practiced_at, mastered_at, is_skipped, source";

function baseQuery(userId: string) {
  return supabase
    .from("wrong_questions")
    .select(BASE_COLUMNS)
    .eq("user_id", userId)
    .eq("source_type", "app_test")
    .is("source_report_id", null);
}

export type OverviewCounts = { active: number; mastered: number };

export async function loadOverviewCounts(userId: string): Promise<OverviewCounts> {
  const { data } = await supabase
    .from("wrong_questions")
    .select("is_active")
    .eq("user_id", userId)
    .eq("source_type", "app_test")
    .is("source_report_id", null);
  const rows = (data as any[]) ?? [];
  return {
    active: rows.filter((r) => r.is_active).length,
    mastered: rows.filter((r) => !r.is_active).length,
  };
}

/** Level 1 — subject cards (active mistakes only, mastered shown as a stat). */
export async function loadSubjects(userId: string): Promise<SubjectNode[]> {
  const [{ data: rows }, { data: subs }] = await Promise.all([
    supabase
      .from("wrong_questions")
      .select("subject_id, chapter_id, is_active")
      .eq("user_id", userId)
      .eq("source_type", "app_test")
      .is("source_report_id", null),
    supabase.from("subjects").select("id, name, name_hi").order("sort_order"),
  ]);

  const meta = new Map<string, { name: string; name_hi: string | null }>();
  (subs ?? []).forEach((s: any) => meta.set(s.id, { name: s.name, name_hi: s.name_hi }));

  const acc = new Map<string, SubjectNode & { _chapters: Set<string> }>();
  ((rows as any[]) ?? []).forEach((r) => {
    const sid = r.subject_id ?? NONE;
    const m = meta.get(sid) ?? { name: "General", name_hi: null };
    const cur =
      acc.get(sid) ??
      { subject_id: sid, name: m.name, name_hi: m.name_hi, active: 0, mastered: 0, chapters: 0, _chapters: new Set<string>() };
    if (r.is_active) {
      cur.active += 1;
      cur._chapters.add(r.chapter_id ?? NONE);
    } else {
      cur.mastered += 1;
    }
    acc.set(sid, cur);
  });

  return [...acc.values()]
    .map(({ _chapters, ...s }) => ({ ...s, chapters: _chapters.size }))
    .filter((s) => s.active > 0 || s.mastered > 0)
    .sort((a, b) => b.active - a.active);
}

/** Level 2 — chapters inside a subject (active only). */
export async function loadChapters(userId: string, subjectId: string): Promise<ChapterNode[]> {
  const real = idFilter(subjectId);
  const [{ data: rows }, { data: chaps }] = await Promise.all([
    supabase
      .from("wrong_questions")
      .select("chapter_id, test_id")
      .eq("user_id", userId)
      .eq("source_type", "app_test")
      .is("source_report_id", null)
      .eq("is_active", true)
      .filter("subject_id", real ? "eq" : "is", real as any),
    supabase.from("chapters").select("id, name, name_hi").order("name"),
  ]);

  const meta = new Map<string, { name: string; name_hi: string | null }>();
  (chaps ?? []).forEach((c: any) => meta.set(c.id, { name: c.name, name_hi: c.name_hi }));

  const acc = new Map<string, ChapterNode & { _tests: Set<string> }>();
  ((rows as any[]) ?? []).forEach((r) => {
    const cid = r.chapter_id ?? NONE;
    const m = meta.get(cid) ?? { name: "General", name_hi: null };
    const cur =
      acc.get(cid) ??
      { chapter_id: cid, name: m.name, name_hi: m.name_hi, active: 0, tests: 0, _tests: new Set<string>() };
    cur.active += 1;
    cur._tests.add(r.test_id ?? NONE);
    acc.set(cid, cur);
  });

  return [...acc.values()]
    .map(({ _tests, ...c }) => ({ ...c, tests: _tests.size }))
    .sort((a, b) => b.active - a.active);
}

/** Level 3 — the App Tests the active mistakes of this chapter came from. */
export async function loadTests(userId: string, subjectId: string, chapterId: string): Promise<TestNode[]> {
  const subject = idFilter(subjectId);
  const chapter = idFilter(chapterId);
  const { data: rows } = await supabase
    .from("wrong_questions")
    .select("test_id, test_name")
    .eq("user_id", userId)
    .eq("source_type", "app_test")
    .is("source_report_id", null)
    .eq("is_active", true)
    .filter("subject_id", subject ? "eq" : "is", subject as any)
    .filter("chapter_id", chapter ? "eq" : "is", chapter as any);

  const list = (rows as any[]) ?? [];
  const testIds = [...new Set(list.map((r) => r.test_id).filter(Boolean))] as string[];
  const titles = new Map<string, string>();
  if (testIds.length) {
    const { data: tests } = await supabase.from("tests").select("id, title").in("id", testIds);
    (tests ?? []).forEach((t: any) => titles.set(t.id, t.title));
  }

  const acc = new Map<string, TestNode>();
  list.forEach((r) => {
    const tid = r.test_id ?? NONE;
    const title = titles.get(r.test_id) ?? r.test_name ?? "Manually added";
    const cur = acc.get(tid) ?? { test_id: tid, title, active: 0 };
    cur.active += 1;
    acc.set(tid, cur);
  });

  return [...acc.values()].sort((a, b) => b.active - a.active);
}

/** Level 4 — the actual active wrong / skipped questions of one test. */
export async function loadTestQuestions(
  userId: string,
  subjectId: string,
  chapterId: string,
  testId: string,
): Promise<MistakeQuestion[]> {
  const subject = idFilter(subjectId);
  const chapter = idFilter(chapterId);
  const test = idFilter(testId);
  const { data } = await baseQuery(userId)
    .eq("is_active", true)
    .filter("subject_id", subject ? "eq" : "is", subject as any)
    .filter("chapter_id", chapter ? "eq" : "is", chapter as any)
    .filter("test_id", test ? "eq" : "is", test as any)
    .order("created_at", { ascending: true });
  return ((data as any[]) ?? []) as MistakeQuestion[];
}

/** Practice payload for one Subject → Chapter → Test bucket. */
export async function loadTestPracticeQuestions(
  userId: string,
  subjectId: string,
  chapterId: string,
  testId: string,
): Promise<PracticeQuestion[]> {
  const rows = await loadTestQuestions(userId, subjectId, chapterId, testId);
  const ids = [...new Set(rows.map((r) => r.question_id).filter(Boolean))] as string[];
  if (ids.length === 0) return [];

  const { data: qs } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, topic")
    .in("id", ids);

  const meta = new Map(rows.filter((r) => r.question_id).map((r) => [r.question_id as string, r]));
  return ((qs as any[]) ?? []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_option,
    explanation: q.explanation ?? null,
    chapter: null,
    topic: q.topic ?? meta.get(q.id)?.topic ?? null,
    previous_answer: meta.get(q.id)?.selected_option ?? null,
  }));
}

export type PracticeOutcome = { questionId: string; correct: boolean };

/**
 * Applies the App Test Mistakes mastery rule after a practice run.
 * Only questions practised inside this module are updated, matched by the
 * stable `question_id`. 2 correct practice answers ⇒ mastered + deactivated.
 */
export async function recordAppTestMistakePractice(
  userId: string,
  outcomes: PracticeOutcome[],
): Promise<void> {
  if (!userId || outcomes.length === 0) return;
  const ids = [...new Set(outcomes.map((o) => o.questionId))];

  const { data } = await supabase
    .from("wrong_questions")
    .select("id, question_id, practice_attempts, practice_correct_count, correct_revision_count, total_attempts, total_correct, total_wrong, wrong_count, is_active")
    .eq("user_id", userId)
    .eq("source_type", "app_test")
    .in("question_id", ids);

  const byQuestion = new Map<string, any>();
  ((data as any[]) ?? []).forEach((r) => r.question_id && byQuestion.set(r.question_id, r));

  const now = new Date().toISOString();

  for (const o of outcomes) {
    const row = byQuestion.get(o.questionId);
    if (!row || !row.is_active) continue;

    const attempts = (row.practice_attempts ?? 0) + 1;

    if (o.correct) {
      const correctCount = Math.min((row.practice_correct_count ?? 0) + 1, APP_TEST_MASTERY_TARGET);
      const mastered = correctCount >= APP_TEST_MASTERY_TARGET;
      await supabase
        .from("wrong_questions")
        .update({
          practice_attempts: attempts,
          practice_correct_count: correctCount,
          correct_revision_count: (row.correct_revision_count ?? 0) + 1,
          total_attempts: (row.total_attempts ?? 0) + 1,
          total_correct: (row.total_correct ?? 0) + 1,
          consecutive_correct: correctCount,
          mastery_score: correctCount,
          last_attempt_result: "correct",
          last_practiced_at: now,
          last_attempt_at: now,
          mastery_status: mastered ? "mastered" : "active",
          is_active: !mastered,
          status: mastered ? "mastered" : "pending",
          mastered_at: mastered ? now : null,
        } as any)
        .eq("id", row.id);
    } else {
      // Wrong again: stays active, correct count is preserved (never inflated).
      await supabase
        .from("wrong_questions")
        .update({
          practice_attempts: attempts,
          total_attempts: (row.total_attempts ?? 0) + 1,
          total_wrong: (row.total_wrong ?? 0) + 1,
          wrong_count: (row.wrong_count ?? 0) + 1,
          last_attempt_result: "wrong",
          last_practiced_at: now,
          last_attempt_at: now,
          mastery_status: "active",
          is_active: true,
          status: "pending",
          mastered_at: null,
        } as any)
        .eq("id", row.id);
    }
  }
}

export async function loadSubjectName(subjectId: string): Promise<string> {
  if (subjectId === NONE) return "General";
  const { data } = await supabase.from("subjects").select("name").eq("id", subjectId).maybeSingle();
  return (data as any)?.name ?? "Subject";
}

export async function loadChapterName(chapterId: string): Promise<string> {
  if (chapterId === NONE) return "General";
  const { data } = await supabase.from("chapters").select("name").eq("id", chapterId).maybeSingle();
  return (data as any)?.name ?? "Chapter";
}

export async function loadTestTitle(testId: string): Promise<string> {
  if (testId === NONE) return "Manually added";
  const { data } = await supabase.from("tests").select("title").eq("id", testId).maybeSingle();
  return (data as any)?.title ?? "App Test";
}
