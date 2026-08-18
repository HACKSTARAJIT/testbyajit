import { supabase } from "@/integrations/supabase/client";

export type OrganizeStatus = "not_organized" | "processing" | "organized" | "updated";

export const STATUS_META: Record<OrganizeStatus, { label: string; dot: string }> = {
  not_organized: { label: "Not Organized", dot: "⚪" },
  processing: { label: "Processing...", dot: "🟡" },
  organized: { label: "Organized", dot: "🟢" },
  updated: { label: "Updated", dot: "🔵" },
};

export type AIQuestion = {
  id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  user_answer: string | null;
  explanation: string | null;
  ai_subtopic: string | null;
  source_status: string | null;
  practice_count: number;
  correct_count: number;
  wrong_count: number;
  last_practice_at: string | null;
  mastered: boolean;
  classified_at: string | null;
  mock_id: string;
  created_at: string;
};

export type SubtopicNode = { subtopic: string; questions: AIQuestion[] };
export type TopicNode = { topic: string; questions: AIQuestion[]; subtopics: SubtopicNode[] };
export type ChapterNode = { chapter: string; total: number; topics: TopicNode[] };

/** Load the AI-classified question repository for one subject, grouped Chapter → Topic. */
export async function loadAIChapters(userId: string, subject: string): Promise<{
  chapters: ChapterNode[];
  mockNames: Record<string, string>;
}> {
  const { data: mocks } = await supabase
    .from("mock_mistake_mocks")
    .select("id, name")
    .eq("user_id", userId)
    .eq("subject", subject);

  const mockNames: Record<string, string> = {};
  const ids = (mocks ?? []).map((m: any) => {
    mockNames[m.id] = m.name;
    return m.id as string;
  });
  if (ids.length === 0) return { chapters: [], mockNames };

  const { data } = await supabase
    .from("mock_mistake_questions")
    .select(
      "id, mock_id, question_text, option_a, option_b, option_c, option_d, correct_answer, user_answer, explanation, ai_chapter, ai_topic, ai_subtopic, source_status, practice_count, correct_count, wrong_count, last_practice_at, mastered, classified_at, created_at",
    )
    .in("mock_id", ids)
    .not("classification_id", "is", null)
    .order("created_at", { ascending: true });

  const map = new Map<string, Map<string, AIQuestion[]>>();
  for (const row of (data ?? []) as any[]) {
    const chapter = row.ai_chapter || "Unclassified";
    const topic = row.ai_topic || "General";
    if (!map.has(chapter)) map.set(chapter, new Map());
    const topics = map.get(chapter)!;
    if (!topics.has(topic)) topics.set(topic, []);
    topics.get(topic)!.push(row as AIQuestion);
  }

  const chapters: ChapterNode[] = [...map.entries()]
    .map(([chapter, topics]) => {
      const nodes = [...topics.entries()]
        .map(([topic, questions]) => ({ topic, questions }))
        .sort((a, b) => b.questions.length - a.questions.length);
      return {
        chapter,
        topics: nodes,
        total: nodes.reduce((s, t) => s + t.questions.length, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  return { chapters, mockNames };
}

/** Stable practice-test key for one AI Chapter topic. */
export function topicSourceKey(subject: string, chapter: string, topic: string) {
  return `topic:${subject}|${chapter}|${topic}`;
}

/** URL param for the topic practice route. */
export function topicRouteKey(chapter: string, topic: string) {
  return encodeURIComponent(`${chapter}|||${topic}`);
}

export function parseTopicRouteKey(param: string): { chapter: string; topic: string } {
  const [chapter = "", topic = ""] = decodeURIComponent(param).split("|||");
  return { chapter, topic };
}

export type TopicTestStats = {
  attempts: number;
  bestAccuracy: number;
  lastAccuracy: number;
  lastAt: string | null;
};

/** Attempt stats for every topic test of one subject, keyed by source_key. */
export async function loadTopicStats(
  userId: string,
  subject: string,
): Promise<Record<string, TopicTestStats>> {
  const { data } = await supabase
    .from("revision_practice_attempts")
    .select("source_key, accuracy, created_at")
    .eq("user_id", userId)
    .eq("source", "mock_mistakes")
    .like("source_key", `topic:${subject}|%`)
    .order("created_at", { ascending: true });

  const out: Record<string, TopicTestStats> = {};
  for (const r of (data ?? []) as any[]) {
    const s = out[r.source_key] ?? { attempts: 0, bestAccuracy: 0, lastAccuracy: 0, lastAt: null };
    s.attempts += 1;
    s.bestAccuracy = Math.max(s.bestAccuracy, r.accuracy ?? 0);
    s.lastAccuracy = r.accuracy ?? 0;
    s.lastAt = r.created_at;
    out[r.source_key] = s;
  }
  return out;
}

/** All classified questions of one Chapter → Topic, as Practice Mode questions. */
export async function loadTopicPracticeQuestions(
  userId: string,
  subject: string,
  chapter: string,
  topic: string,
) {
  const { chapters } = await loadAIChapters(userId, subject);
  const ch = chapters.find((c) => c.chapter === chapter);
  const t = ch?.topics.find((x) => x.topic === topic);
  return (t?.questions ?? []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    chapter,
    topic,
    previous_answer: q.user_answer,
  }));
}
