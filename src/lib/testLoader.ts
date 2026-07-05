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
 */
export async function loadTestWithQuestions(testId: string): Promise<LoadedTest> {
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
