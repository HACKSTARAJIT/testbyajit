import { supabase } from "@/integrations/supabase/client";

export type PracticeQuestion = {
  id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  explanation: string | null;
  chapter: string | null;
  topic: string | null;
  /** what the student answered earlier (mock mistakes import) */
  previous_answer?: string | null;
};

export type PracticeSource = "wrong_questions" | "mock_mistakes";

export type AttemptRow = {
  id: string;
  source: PracticeSource;
  source_key: string;
  title: string;
  subject: string | null;
  chapter: string | null;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  accuracy: number;
  time_taken_seconds: number;
  details: any[];
  ai_analysis: string | null;
  ai_comparison: string | null;
  created_at: string;
};

/** Wrong + skipped questions collected inside PRACTICE WITH AJIT tests, for one chapter. */
export async function loadWrongQuestionPractice(
  userId: string,
  subjectId: string,
  chapterId: string,
): Promise<PracticeQuestion[]> {
  const realSubject = subjectId === "none" ? null : subjectId;
  const realChapter = chapterId === "none" ? null : chapterId;

  const { data: wq } = await supabase
    .from("wrong_questions")
    .select("question_id, question_text, correct_option, explanation, selected_option, wrong_count")
    .eq("user_id", userId)
    .eq("source_type", "app_test")
    .eq("status", "pending")
    .eq("is_active", true)
    .is("source_report_id", null)
    .filter("subject_id", realSubject ? "eq" : "is", realSubject as any)
    .filter("chapter_id", realChapter ? "eq" : "is", realChapter as any);

  const rows = (wq as any[]) ?? [];
  const ids = [...new Set(rows.map((r) => r.question_id).filter(Boolean))] as string[];
  if (ids.length === 0) return [];

  const { data: qs } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, topic")
    .in("id", ids);

  const meta = new Map(rows.filter((r) => r.question_id).map((r) => [r.question_id, r]));

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
    topic: q.topic ?? null,
    previous_answer: meta.get(q.id)?.selected_option ?? null,
  }));
}

/** Questions imported inside a Mock Mistakes mock. */
export async function loadMockMistakePractice(mockId: string): Promise<PracticeQuestion[]> {
  const { data } = await supabase
    .from("mock_mistake_questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_answer, user_answer, chapter, topic, explanation")
    .eq("mock_id", mockId)
    .order("sort_order");
  return ((data as any[]) ?? []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    chapter: q.chapter,
    topic: q.topic,
    previous_answer: q.user_answer,
  }));
}

export type SaveAttemptInput = {
  userId: string;
  source: PracticeSource;
  sourceKey: string;
  title: string;
  subject?: string | null;
  chapter?: string | null;
  questions: PracticeQuestion[];
  answers: Record<string, string>;
  timeTakenSeconds: number;
  /** presentation-only: was this attempt taken with Shuffle Mode ON */
  shuffleMode?: boolean;
};

/** Always APPENDS a new attempt — previous attempts are never overwritten. */
export async function saveAttempt(input: SaveAttemptInput): Promise<AttemptRow | null> {
  const { questions, answers } = input;
  const details = questions.map((q) => {
    const picked = answers[q.id] ?? null;
    return {
      question_id: q.id,
      question_text: q.question_text,
      chapter: q.chapter,
      topic: q.topic,
      correct_answer: q.correct_answer,
      selected: picked,
      status: !picked ? "skipped" : picked === q.correct_answer ? "correct" : "wrong",
    };
  });
  const correct = details.filter((d) => d.status === "correct").length;
  const wrong = details.filter((d) => d.status === "wrong").length;
  const skipped = details.filter((d) => d.status === "skipped").length;

  const { data, error } = await supabase
    .from("revision_practice_attempts")
    .insert({
      user_id: input.userId,
      source: input.source,
      source_key: input.sourceKey,
      title: input.title,
      subject: input.subject ?? null,
      chapter: input.chapter ?? null,
      total_questions: questions.length,
      shuffle_mode: input.shuffleMode ?? false,
      correct_count: correct,
      wrong_count: wrong,
      skipped_count: skipped,
      accuracy: questions.length ? Math.round((correct / questions.length) * 100) : 0,
      time_taken_seconds: input.timeTakenSeconds,
      details,
    } as any)
    .select("*")
    .single();

  if (error) {
    console.error("saveAttempt failed", error);
    return null;
  }
  return data as any as AttemptRow;
}

export async function loadAttempts(
  userId: string,
  source: PracticeSource,
  sourceKey: string,
): Promise<AttemptRow[]> {
  const { data } = await supabase
    .from("revision_practice_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_key", sourceKey)
    .order("created_at", { ascending: true });
  return ((data as any[]) ?? []) as AttemptRow[];
}

export type PracticeStats = {
  totalAttempts: number;
  latestScore: string;
  bestScore: string;
  averageScore: number;
  latestAccuracy: number;
  highestAccuracy: number;
  improvementPct: number;
  lastPlayed: string | null;
};

/** rows must be ordered oldest → newest */
export function computeStats(rows: AttemptRow[]): PracticeStats | null {
  if (rows.length === 0) return null;
  const latest = rows[rows.length - 1];
  const first = rows[0];
  const best = rows.reduce((a, b) => (b.correct_count > a.correct_count ? b : a));
  const avg = rows.reduce((s, r) => s + r.correct_count, 0) / rows.length;
  const highestAccuracy = Math.max(...rows.map((r) => r.accuracy));
  return {
    totalAttempts: rows.length,
    latestScore: `${latest.correct_count}/${latest.total_questions}`,
    bestScore: `${best.correct_count}/${best.total_questions}`,
    averageScore: Math.round(avg * 10) / 10,
    latestAccuracy: latest.accuracy,
    highestAccuracy,
    improvementPct: latest.accuracy - first.accuracy,
    lastPlayed: latest.created_at,
  };
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/** Hindi AI analysis / comparison for one completed attempt. */
export async function requestAI(
  attemptId: string,
  mode: "analyze" | "compare",
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("revision-practice-ai", {
    body: { attemptId, mode },
  });
  if (error) throw error;
  const text = (data as any)?.text;
  if (!text) throw new Error((data as any)?.error || "AI ने कोई जवाब नहीं दिया।");
  return text as string;
}
