import { supabase } from "@/integrations/supabase/client";

/**
 * 🔥 Repeat Mistake Detection — READ-ONLY derived layer.
 *
 * Uses ONLY existing App-Test history (`wrong_questions` rows created by the
 * Test Engine / revision flow, i.e. source_report_id IS NULL). It never writes,
 * never creates questions and never touches Mock Mistakes data.
 */

export type RepeatSeverity = "emerging" | "repeated" | "critical" | "improving" | "resolved" | "none";

export type RepeatRow = {
  question_id: string | null;
  question_text: string | null;
  topic: string | null;
  chapter: string | null;
  subject: string | null;
  attempts: number;
  wrong: number;
  skipped: number;
  correct: number;
  consecutiveCorrect: number;
  lastResult: string | null;
  lastAt: string | null;
  severity: RepeatSeverity;
};

export type RepeatTopic = {
  topic: string;
  subject: string | null;
  questions: number;
  wrong: number;
  severity: RepeatSeverity;
};

export type RepeatSummary = {
  questions: RepeatRow[];
  topics: RepeatTopic[];
  hasEvidence: boolean;
};

export const SEVERITY_META: Record<Exclude<RepeatSeverity, "none">, { label: string; icon: string; tone: string }> = {
  emerging: { label: "उभरती गलती", icon: "🟡", tone: "text-yellow-400" },
  repeated: { label: "दोहराई गई गलती", icon: "🟠", tone: "text-orange-400" },
  critical: { label: "गंभीर दोहराव", icon: "🔴", tone: "text-red-400" },
  improving: { label: "सुधार हो रहा है", icon: "🟢", tone: "text-emerald-400" },
  resolved: { label: "ठीक हो गई", icon: "🟢", tone: "text-emerald-400" },
};

/** Severity from actual history only — never assigned without ≥2 bad outcomes. */
export function severityFor(input: {
  bad: number;
  consecutiveCorrect: number;
  status?: string | null;
}): RepeatSeverity {
  const { bad, consecutiveCorrect, status } = input;
  if (bad < 2) return "none";
  if (status === "mastered" || consecutiveCorrect >= 2) return "resolved";
  if (consecutiveCorrect === 1) return "improving";
  if (bad >= 4) return "critical";
  if (bad === 3) return "repeated";
  return "emerging";
}

type WQRow = {
  question_id: string | null;
  question_text: string | null;
  topic: string | null;
  status: string | null;
  wrong_count: number | null;
  total_attempts: number | null;
  total_wrong: number | null;
  total_correct: number | null;
  total_skipped: number | null;
  consecutive_correct: number | null;
  last_attempt_result: string | null;
  last_attempt_at: string | null;
  subjects?: { name: string } | null;
  chapters?: { name: string } | null;
};

function badCount(r: WQRow) {
  const explicit = (r.total_wrong ?? 0) + (r.total_skipped ?? 0);
  return explicit > 0 ? explicit : r.wrong_count ?? 0;
}

/**
 * Detects repeat mistakes for a student.
 * @param questionIds optionally limit question-level rows to one test's questions.
 */
export async function detectRepeatMistakes(
  userId: string,
  questionIds?: string[],
): Promise<RepeatSummary> {
  if (!userId) return { questions: [], topics: [], hasEvidence: false };

  const { data } = await supabase
    .from("wrong_questions")
    .select(
      "question_id, question_text, topic, status, wrong_count, total_attempts, total_wrong, total_correct, total_skipped, consecutive_correct, last_attempt_result, last_attempt_at, subjects(name), chapters(name)",
    )
    .eq("user_id", userId)
    .is("source_report_id", null)
    .not("question_id", "is", null);

  const rows = ((data as any as WQRow[]) ?? []).filter((r) => !!r.question_id);

  const mapped: RepeatRow[] = rows.map((r) => {
    const bad = badCount(r);
    return {
      question_id: r.question_id,
      question_text: r.question_text,
      topic: (r.topic ?? "").trim() || null,
      chapter: r.chapters?.name ?? null,
      subject: r.subjects?.name ?? null,
      attempts: r.total_attempts ?? bad,
      wrong: r.total_wrong ?? bad,
      skipped: r.total_skipped ?? 0,
      correct: r.total_correct ?? 0,
      consecutiveCorrect: r.consecutive_correct ?? 0,
      lastResult: r.last_attempt_result ?? null,
      lastAt: r.last_attempt_at ?? null,
      severity: severityFor({ bad, consecutiveCorrect: r.consecutive_correct ?? 0, status: r.status }),
    };
  });

  // Topic-level repeats use the whole App-Test history (different questions, same concept).
  const byTopic = new Map<string, { subject: string | null; questions: number; wrong: number; improving: number }>();
  for (const r of mapped) {
    const key = r.topic ?? r.chapter;
    if (!key) continue;
    const bad = r.wrong + r.skipped;
    if (bad < 1) continue;
    const cur = byTopic.get(key) ?? { subject: r.subject, questions: 0, wrong: 0, improving: 0 };
    cur.questions += 1;
    cur.wrong += bad;
    if (r.severity === "improving" || r.severity === "resolved") cur.improving += 1;
    byTopic.set(key, cur);
  }

  const topics: RepeatTopic[] = [...byTopic.entries()]
    .map(([topic, v]) => ({
      topic,
      subject: v.subject,
      questions: v.questions,
      wrong: v.wrong,
      severity:
        v.questions > 0 && v.improving === v.questions
          ? ("improving" as RepeatSeverity)
          : severityFor({ bad: v.wrong, consecutiveCorrect: 0 }),
    }))
    .filter((t) => t.severity !== "none")
    .sort((a, b) => b.wrong - a.wrong);

  const scoped = questionIds?.length
    ? mapped.filter((r) => questionIds.includes(r.question_id!))
    : mapped;

  const questions = scoped
    .filter((r) => r.severity !== "none" && r.severity !== "resolved")
    .sort((a, b) => b.wrong + b.skipped - (a.wrong + a.skipped));

  return {
    questions,
    topics,
    hasEvidence: questions.length > 0 || topics.length > 0,
  };
}

/** Short Hindi line for one repeated question. */
export function questionLine(r: RepeatRow, i: number): string {
  const bad = r.wrong + r.skipped;
  return `यही प्रश्न (#${i + 1}) — ${r.attempts} बार सामने आया, ${bad} बार गलत/छूटा`;
}

/** Short Hindi line for one repeated topic. */
export function topicLine(t: RepeatTopic): string {
  return `${t.topic} — ${t.wrong} बार गलती`;
}
