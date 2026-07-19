import { supabase } from "@/integrations/supabase/client";

/**
 * AI Mock Revision Hub — aggregation layer over the existing wrong_questions bank.
 *
 * The Hub does NOT duplicate storage. It reads live from `wrong_questions`
 * (permanent collection that recordAttempt() writes to after every completed
 * Practice Test / Full Mock) and from `ai_mock_reports` to know how many full
 * mocks the student has uploaded/analysed.
 */

export type HubStats = {
  fullMocksAnalyzed: number;      // ai_mock_reports rows
  practiceTestsAnalyzed: number;  // distinct source tests contributing questions
  wrong: number;                  // pending wrong (wrong_count >= 1)
  skipped: number;                // pending is_skipped
  guessWrong: number;             // pending is_guess
  repeatedWrong: number;          // wrong_count >= 2
  critical: number;               // priority = critical
  mastered: number;
  pending: number;
  neverCorrect: number;           // pending & correct_revision_count = 0
};

export type HubGroup = {
  testId: string;
  title: string;
  testPart: string | null;
  pending: number;
  mastered: number;
  wrong: number;
  skipped: number;
  guess: number;
  critical: number;
  repeated: number;
  lastAttempt: string | null;
};

/** Top-level summary numbers for the Mock Revision Hub. */
export async function loadHubStats(userId: string): Promise<HubStats> {
  const [{ data: rows }, { count: mockCount }] = await Promise.all([
    supabase
      .from("wrong_questions")
      .select("status, priority, wrong_count, is_guess, is_skipped, correct_revision_count, test_id")
      .eq("user_id", userId),
    supabase
      .from("ai_mock_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "completed").eq("analysis_status", "verified"),
  ]);

  const list = (rows as any[]) ?? [];
  const practiceTests = new Set<string>();
  let wrong = 0, skipped = 0, guessWrong = 0, repeatedWrong = 0,
      critical = 0, mastered = 0, pending = 0, neverCorrect = 0;

  for (const r of list) {
    if (r.test_id) practiceTests.add(r.test_id);
    if (r.status === "mastered") { mastered += 1; continue; }
    pending += 1;
    if ((r.wrong_count ?? 0) >= 1) wrong += 1;
    if (r.is_skipped) skipped += 1;
    if (r.is_guess) guessWrong += 1;
    if ((r.wrong_count ?? 0) >= 2) repeatedWrong += 1;
    if (r.priority === "critical") critical += 1;
    if ((r.correct_revision_count ?? 0) === 0) neverCorrect += 1;
  }

  return {
    fullMocksAnalyzed: mockCount ?? 0,
    practiceTestsAnalyzed: practiceTests.size,
    wrong, skipped, guessWrong, repeatedWrong,
    critical, mastered, pending, neverCorrect,
  };
}

/** Groups of pending questions by source test — one row per Practice Test / Mock. */
export async function loadHubGroups(userId: string, limit = 30): Promise<HubGroup[]> {
  const { data: rows } = await supabase
    .from("wrong_questions")
    .select("status, priority, wrong_count, is_guess, is_skipped, test_id, last_attempt_at")
    .eq("user_id", userId)
    .not("test_id", "is", null);

  const list = (rows as any[]) ?? [];
  const groups = new Map<string, HubGroup>();

  for (const r of list) {
    const g = groups.get(r.test_id) ?? {
      testId: r.test_id, title: "", testPart: null,
      pending: 0, mastered: 0, wrong: 0, skipped: 0,
      guess: 0, critical: 0, repeated: 0, lastAttempt: null,
    };
    if (r.status === "mastered") g.mastered += 1;
    else {
      g.pending += 1;
      if ((r.wrong_count ?? 0) >= 1) g.wrong += 1;
      if (r.is_skipped) g.skipped += 1;
      if (r.is_guess) g.guess += 1;
      if (r.priority === "critical") g.critical += 1;
      if ((r.wrong_count ?? 0) >= 2) g.repeated += 1;
    }
    if (r.last_attempt_at && (!g.lastAttempt || r.last_attempt_at > g.lastAttempt)) {
      g.lastAttempt = r.last_attempt_at;
    }
    groups.set(r.test_id, g);
  }

  const ids = [...groups.keys()];
  if (ids.length === 0) return [];

  const { data: tests } = await supabase
    .from("tests")
    .select("id, title, test_part")
    .in("id", ids);

  (tests ?? []).forEach((t: any) => {
    const g = groups.get(t.id);
    if (g) { g.title = t.title ?? "Untitled Test"; g.testPart = t.test_part ?? null; }
  });

  return [...groups.values()]
    .filter((g) => g.title) // drop orphaned deleted tests
    .sort((a, b) => (b.critical - a.critical) || (b.pending - a.pending))
    .slice(0, limit);
}
