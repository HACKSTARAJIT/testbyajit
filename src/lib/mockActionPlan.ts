import { supabase } from "@/integrations/supabase/client";
import type { PracticeQuestion } from "@/lib/revisionPractice";

export type ActionItem = {
  action_key: string;
  bucket: "today" | "next";
  area_key: string;
  subject: string;
  chapter: string;
  topic: string;
  action_type: string;
  priority: string;
  condition: string;
  title: string;
  why: string;
  how: string;
  question_ids: string[];
  question_count: number;
  repeat_only: boolean;
  stats: {
    total: number;
    unresolved: number;
    resolved: number;
    repeat_wrong: number;
    never_practiced: number;
  };
};

export type ActionPlan = {
  overview?: string;
  insufficient_data?: boolean;
  today?: ActionItem[];
  next?: ActionItem[];
  improvement?: string;
  totals?: { questions: number; mocks: number; unresolved: number; resolved: number };
};

export const PRIORITY_META: Record<string, { dot: string; label: string; cls: string }> = {
  critical: { dot: "🔴", label: "सबसे ज़रूरी", cls: "text-destructive" },
  high: { dot: "🟠", label: "उच्च प्राथमिकता", cls: "text-orange-400" },
  medium: { dot: "🟡", label: "मध्यम", cls: "text-yellow-400" },
  improving: { dot: "🔵", label: "सुधार हो रहा है", cls: "text-sky-400" },
  controlled: { dot: "🟢", label: "नियंत्रण में", cls: "text-emerald-400" },
};

export const ACTION_LABEL: Record<string, string> = {
  revise: "दोहराएँ",
  re_attempt: "दोबारा हल करें",
  repeat_practice: "बार-बार अभ्यास",
  review_mistakes: "गलतियाँ देखें",
  topic_focus: "Topic पर फोकस",
  clear_repeat_mistakes: "Repeat Mistakes हटाएँ",
  unresolved: "बाकी प्रश्न पूरे करें",
};

export function priorityOf(p?: string) {
  return PRIORITY_META[(p ?? "").toLowerCase()] ?? PRIORITY_META.medium;
}

/** Saved plan row for one student. */
export async function loadActionPlan(userId: string) {
  const { data } = await supabase
    .from("mock_mistake_action_plans")
    .select("plan, status, error, generated_at, questions_analyzed")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function loadCompletions(userId: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("mock_mistake_action_completions")
    .select("action_key, completed_at")
    .eq("user_id", userId);
  const out: Record<string, string> = {};
  for (const r of (data as any[]) ?? []) out[r.action_key] = r.completed_at;
  return out;
}

export async function markActionCompleted(userId: string, action: ActionItem) {
  await supabase.from("mock_mistake_action_completions").upsert(
    {
      user_id: userId,
      action_key: action.action_key,
      title: action.title,
      completed_at: new Date().toISOString(),
      snapshot: { stats: action.stats, question_ids: action.question_ids } as any,
    } as any,
    { onConflict: "user_id,action_key" },
  );
}

export async function unmarkActionCompleted(userId: string, actionKey: string) {
  await supabase
    .from("mock_mistake_action_completions")
    .delete()
    .eq("user_id", userId)
    .eq("action_key", actionKey);
}

export function findAction(plan: ActionPlan | null, actionKey: string): ActionItem | null {
  const all = [...(plan?.today ?? []), ...(plan?.next ?? [])];
  return all.find((a) => a.action_key === actionKey) ?? null;
}

/**
 * The exact original imported questions of an action — nothing generated,
 * nothing rewritten.
 */
export async function loadActionQuestions(ids: string[]): Promise<PracticeQuestion[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("mock_mistake_questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_answer, user_answer, chapter, topic, ai_chapter, ai_topic, explanation")
    .in("id", ids);
  const order = new Map(ids.map((id, i) => [id, i]));
  return ((data as any[]) ?? [])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((q) => ({
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      chapter: q.ai_chapter ?? q.chapter,
      topic: q.ai_topic ?? q.topic,
      previous_answer: q.user_answer,
    }));
}
