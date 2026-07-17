import { supabase } from "@/integrations/supabase/client";
import type { EngineQuestion } from "@/components/TestEngine";

export interface LoadedTest {
  test: any | null;
  questions: EngineQuestion[];
  /** Raw database/query error messages, if any */
  testError: string | null;
  questionsError: string | null;
}

/**
 * SINGLE shared question loader.
 * Used by the Student Test page, the Admin post-publish validation
 * and the Admin Debug Panel — so all of them always see identical data.
 *
 * When a userId is provided we first ensure an in_progress test_attempt
 * exists — this is what lets RLS on `questions` allow the read (answer
 * keys are only visible to admins or to users who have started the test).
 */
export async function loadTestWithQuestions(
  testId: string,
  userId?: string | null,
): Promise<LoadedTest> {
  if (userId) {
    // Ensure the user has an attempt row so the questions RLS policy passes.
    const { data: existing } = await supabase
      .from("test_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("test_id", testId)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      await supabase.from("test_attempts").insert({
        user_id: userId,
        test_id: testId,
        status: "in_progress",
        answers: {},
      } as any);
    }
  }

  const [tRes, qRes] = await Promise.all([
    supabase.from("tests").select("*, subjects(name)").eq("id", testId).maybeSingle(),
    supabase.from("questions").select("*").eq("test_id", testId).order("sort_order"),
  ]);

  return {
    test: tRes.data ?? null,
    questions: (qRes.data as any as EngineQuestion[]) ?? [],
    testError: tRes.error?.message ?? null,
    questionsError: qRes.error?.message ?? null,
  };
}
