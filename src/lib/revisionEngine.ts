import { supabase } from "@/integrations/supabase/client";
import type { EngineQuestion, EngineTest } from "@/components/TestEngine";

// Priority derived from how many times a question was answered wrong
export function priorityForCount(wrongCount: number): "low" | "medium" | "high" {
  if (wrongCount >= 3) return "high";
  if (wrongCount === 2) return "medium";
  return "low";
}

const MASTERY_STREAK = 2; // consecutive correct revision attempts to master

type ExistingWQ = {
  id: string;
  question_id: string | null;
  wrong_count: number;
  correct_revision_count: number;
  consecutive_correct: number;
  status: string;
};

/**
 * Records the outcome of a completed test attempt into the smart wrong-question
 * bank, then (re)generates the linked auto "Wrong & Skipped" revision test.
 *
 * - Wrong or skipped questions are upserted (wrong_count++, priority recomputed).
 * - Correct answers to questions already in the bank count as a correct revision:
 *   after MASTERY_STREAK consecutive correct attempts they become "mastered".
 * - Mastered questions answered wrong again return to "pending".
 */
export async function recordAttempt(
  userId: string,
  test: EngineTest,
  questions: EngineQuestion[],
  answers: Record<string, string>,
): Promise<void> {
  if (!userId) return;

  // Load existing bank rows for these questions
  const qIds = questions.map((q) => q.id);
  const { data: existingRows } = await supabase
    .from("wrong_questions")
    .select("id, question_id, wrong_count, correct_revision_count, consecutive_correct, status")
    .eq("user_id", userId)
    .in("question_id", qIds);

  const existing = new Map<string, ExistingWQ>();
  (existingRows as any as ExistingWQ[] | null)?.forEach((r) => {
    if (r.question_id) existing.set(r.question_id, r);
  });

  const now = new Date().toISOString();

  for (const q of questions) {
    const chosen = answers[q.id];
    const attempted = chosen != null && chosen !== "";
    const correct = attempted && chosen === q.correct_option;
    const prev = existing.get(q.id);

    if (!correct) {
      // Wrong or skipped -> add / bump in the bank
      if (prev) {
        const wrongCount = (prev.wrong_count ?? 1) + 1;
        await supabase
          .from("wrong_questions")
          .update({
            wrong_count: wrongCount,
            consecutive_correct: 0,
            priority: priorityForCount(wrongCount),
            status: "pending",
            mastered_at: null,
            selected_option: attempted ? chosen : null,
            correct_option: q.correct_option,
            last_attempt_at: now,
          } as any)
          .eq("id", prev.id);
      } else {
        await supabase.from("wrong_questions").insert({
          user_id: userId,
          test_id: test.id,
          subject_id: test.subject_id ?? null,
          chapter_id: test.chapter_id ?? null,
          question_id: q.id,
          image_path: null,
          question_text: q.question_text,
          selected_option: attempted ? chosen : null,
          correct_option: q.correct_option,
          explanation: q.explanation ?? null,
          test_part: test.test_part ?? null,
          priority: "low",
          status: "pending",
          source: "auto",
          wrong_count: 1,
          consecutive_correct: 0,
          last_attempt_at: now,
        } as any);
      }
    } else if (prev && prev.status !== "mastered") {
      // Correct answer to a question already in the bank = successful revision
      const streak = (prev.consecutive_correct ?? 0) + 1;
      const mastered = streak >= MASTERY_STREAK;
      await supabase
        .from("wrong_questions")
        .update({
          correct_revision_count: (prev.correct_revision_count ?? 0) + 1,
          consecutive_correct: streak,
          status: mastered ? "mastered" : "pending",
          mastered_at: mastered ? now : null,
          last_attempt_at: now,
        } as any)
        .eq("id", prev.id);
    }
  }

  await regenerateRevisionTest(userId, test);
}

/** Rebuilds the auto revision test for one original test from current pending items. */
export async function regenerateRevisionTest(userId: string, test: EngineTest): Promise<void> {
  const { data: pending } = await supabase
    .from("wrong_questions")
    .select("question_id")
    .eq("user_id", userId)
    .eq("test_id", test.id)
    .eq("status", "pending")
    .not("question_id", "is", null);

  const questionIds = [...new Set((pending ?? []).map((r: any) => r.question_id).filter(Boolean))];

  if (questionIds.length === 0) {
    await supabase.from("revision_tests").delete().eq("user_id", userId).eq("test_id", test.id);
    return;
  }

  await supabase.from("revision_tests").upsert(
    {
      user_id: userId,
      test_id: test.id,
      subject_id: test.subject_id ?? null,
      chapter_id: test.chapter_id ?? null,
      title: `${test.title} — Wrong & Skipped`,
      question_ids: questionIds,
      question_count: questionIds.length,
    } as any,
    { onConflict: "user_id,test_id" },
  );
}

/** Loads full question rows for a set of ids, preserving the given order. */
export async function loadQuestionsByIds(ids: string[]): Promise<EngineQuestion[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks")
    .in("id", ids);
  const byId = new Map((data ?? []).map((q: any) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as EngineQuestion[];
}

/** All pending wrong-question ids for a user (for Today's Revision). */
export async function loadTodaysRevisionIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("wrong_questions")
    .select("question_id, priority")
    .eq("user_id", userId)
    .eq("status", "pending")
    .not("question_id", "is", null)
    .order("priority", { ascending: true });
  return [...new Set((data ?? []).map((r: any) => r.question_id).filter(Boolean))];
}

/**
 * Records a revision attempt (from Today's Revision or an auto revision test).
 * Correct answers build the mastery streak; wrong answers bump wrong_count.
 * Then regenerates every revision test whose questions were touched.
 */
export async function recordRevisionAttempt(
  userId: string,
  questions: EngineQuestion[],
  answers: Record<string, string>,
): Promise<void> {
  if (!userId) return;
  const qIds = questions.map((q) => q.id);
  const { data: rows } = await supabase
    .from("wrong_questions")
    .select("id, question_id, test_id, wrong_count, correct_revision_count, consecutive_correct, status")
    .eq("user_id", userId)
    .in("question_id", qIds);

  const byQ = new Map<string, any>();
  (rows ?? []).forEach((r: any) => r.question_id && byQ.set(r.question_id, r));
  const now = new Date().toISOString();
  const affectedTests = new Set<string>();

  for (const q of questions) {
    const prev = byQ.get(q.id);
    if (!prev) continue;
    if (prev.test_id) affectedTests.add(prev.test_id);
    const chosen = answers[q.id];
    const correct = chosen != null && chosen !== "" && chosen === q.correct_option;

    if (correct && prev.status !== "mastered") {
      const streak = (prev.consecutive_correct ?? 0) + 1;
      const mastered = streak >= 2;
      await supabase.from("wrong_questions").update({
        correct_revision_count: (prev.correct_revision_count ?? 0) + 1,
        consecutive_correct: streak,
        status: mastered ? "mastered" : "pending",
        mastered_at: mastered ? now : null,
        last_attempt_at: now,
      } as any).eq("id", prev.id);
    } else if (!correct) {
      const wrongCount = (prev.wrong_count ?? 1) + 1;
      await supabase.from("wrong_questions").update({
        wrong_count: wrongCount,
        consecutive_correct: 0,
        priority: priorityForCount(wrongCount),
        status: "pending",
        mastered_at: null,
        selected_option: chosen ?? null,
        last_attempt_at: now,
      } as any).eq("id", prev.id);
    }
  }

  for (const testId of affectedTests) {
    await regenerateRevisionTestById(userId, testId);
  }
}

async function regenerateRevisionTestById(userId: string, testId: string): Promise<void> {
  const { data: test } = await supabase
    .from("tests")
    .select("id, title, subject_id, chapter_id, test_part")
    .eq("id", testId)
    .maybeSingle();
  if (!test) return;
  await regenerateRevisionTest(userId, test as any);
}

