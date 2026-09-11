import { supabase } from "@/integrations/supabase/client";
import type { EngineQuestion } from "@/components/TestEngine";

export interface LoadedTest {
  test: any | null;
  questions: EngineQuestion[];
  /** Raw database/query error messages, if any */
  testError: string | null;
  questionsError: string | null;
}

async function fetchQuestions(testId: string) {
  return supabase.from("questions").select("*").eq("test_id", testId).order("sort_order");
}

/**
 * Ensures the user has a test_attempt row for this test, so the RLS policy on
 * `questions` allows reading them. Returns an error message when it fails.
 */
async function ensureAttempt(testId: string, userId: string): Promise<string | null> {
  const { data: existing, error: selErr } = await supabase
    .from("test_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("test_id", testId)
    .limit(1)
    .maybeSingle();
  if (selErr) return selErr.message;
  if (existing) return null;

  const { error: insErr } = await supabase.from("test_attempts").insert({
    user_id: userId,
    test_id: testId,
    status: "in_progress",
    answers: {},
  } as any);
  return insErr?.message ?? null;
}

/**
 * SINGLE shared question loader.
 * Used by the Student Test page, the Admin preview, the Admin post-publish
 * validation and the Admin Debug Panel — so all of them always see identical data.
 */
export async function loadTestWithQuestions(
  testId: string,
  userId?: string | null,
): Promise<LoadedTest> {
  let attemptError: string | null = null;
  if (userId) attemptError = await ensureAttempt(testId, userId);

  const [tRes, qRes] = await Promise.all([
    supabase.from("tests").select("*, subjects(name)").eq("id", testId).maybeSingle(),
    fetchQuestions(testId),
  ]);

  let questions = (qRes.data as any as EngineQuestion[]) ?? [];
  let questionsError = qRes.error?.message ?? null;

  // Retry once: the attempt row may have been created a moment after the read
  // started, which is exactly what used to cause a false "no questions" state.
  if (!questionsError && questions.length === 0 && userId) {
    const retryAttemptError = await ensureAttempt(testId, userId);
    const retry = await fetchQuestions(testId);
    questions = (retry.data as any as EngineQuestion[]) ?? [];
    questionsError = retry.error?.message ?? null;
    if (!questionsError && questions.length === 0 && (attemptError || retryAttemptError)) {
      questionsError = `Could not start your attempt for this test: ${attemptError || retryAttemptError}`;
    }
  }

  if (!questionsError && questions.length === 0 && !userId && tRes.data) {
    questionsError = "Please sign in to load and attempt this test.";
  }

  return {
    test: tRes.data ?? null,
    questions,
    testError: tRes.error?.message ?? null,
    questionsError,
  };
}
