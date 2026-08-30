import { supabase } from "@/integrations/supabase/client";
import type { PracticeSource } from "@/lib/revisionPractice";

export type SessionStatus = "active" | "paused" | "completed" | "abandoned";

export type PracticeSessionRow = {
  id: string;
  user_id: string;
  source: PracticeSource;
  source_key: string;
  title: string;
  subject: string | null;
  chapter: string | null;
  question_ids: string[];
  option_order: Record<string, string[]>;
  shuffle_mode: boolean;
  current_index: number;
  current_question_id: string | null;
  answers: Record<string, string>;
  marked: string[];
  skipped: string[];
  elapsed_seconds: number;
  remaining_seconds: number | null;
  status: SessionStatus;
  last_saved_at: string;
};

const table = () => supabase.from("practice_sessions" as any);

/** The single resumable (active/paused) session for this user + source + mock/topic. */
export async function loadLiveSession(
  userId: string,
  source: PracticeSource,
  sourceKey: string,
): Promise<PracticeSessionRow | null> {
  const { data } = await table()
    .select("*")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_key", sourceKey)
    .in("status", ["active", "paused"])
    .order("last_saved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any as PracticeSessionRow) ?? null;
}

/** All resumable sessions of a user (for "Paused Test" cards). */
export async function loadPausedSessions(userId: string): Promise<PracticeSessionRow[]> {
  const { data } = await table()
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "paused"])
    .order("last_saved_at", { ascending: false });
  return ((data as any[]) ?? []) as PracticeSessionRow[];
}

export type CreateSessionInput = {
  userId: string;
  source: PracticeSource;
  sourceKey: string;
  title: string;
  subject?: string | null;
  chapter?: string | null;
  questionIds: string[];
  optionOrder: Record<string, string[]>;
  shuffleMode: boolean;
  remainingSeconds?: number | null;
};

/** Starting fresh abandons any previous live session for the same user + source key. */
export async function createSession(input: CreateSessionInput): Promise<string | null> {
  await abandonLiveSessions(input.userId, input.source, input.sourceKey);
  const { data, error } = await table()
    .insert({
      user_id: input.userId,
      source: input.source,
      source_key: input.sourceKey,
      title: input.title,
      subject: input.subject ?? null,
      chapter: input.chapter ?? null,
      question_ids: input.questionIds,
      option_order: input.optionOrder,
      shuffle_mode: input.shuffleMode,
      current_index: 0,
      current_question_id: input.questionIds[0] ?? null,
      answers: {},
      marked: [],
      skipped: [],
      elapsed_seconds: 0,
      remaining_seconds: input.remainingSeconds ?? null,
      status: "active",
      last_saved_at: new Date().toISOString(),
    } as any)
    .select("id")
    .single();
  if (error) { console.error("createSession failed", error); return null; }
  return (data as any).id as string;
}

export type SaveSessionInput = {
  sessionId: string;
  currentIndex: number;
  currentQuestionId: string | null;
  answers: Record<string, string>;
  marked: string[];
  skipped: string[];
  elapsedSeconds: number;
  remainingSeconds?: number | null;
  status: SessionStatus;
};

export async function saveSession(input: SaveSessionInput): Promise<void> {
  const { error } = await table()
    .update({
      current_index: input.currentIndex,
      current_question_id: input.currentQuestionId,
      answers: input.answers,
      marked: input.marked,
      skipped: input.skipped,
      elapsed_seconds: Math.max(0, Math.round(input.elapsedSeconds)),
      ...(input.remainingSeconds === undefined ? {} : { remaining_seconds: input.remainingSeconds }),
      status: input.status,
      last_saved_at: new Date().toISOString(),
    } as any)
    .eq("id", input.sessionId);
  if (error) console.error("saveSession failed", error);
}

export async function setSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  const { error } = await table()
    .update({ status, last_saved_at: new Date().toISOString() } as any)
    .eq("id", sessionId);
  if (error) console.error("setSessionStatus failed", error);
}

async function abandonLiveSessions(userId: string, source: PracticeSource, sourceKey: string) {
  await table()
    .update({ status: "abandoned", last_saved_at: new Date().toISOString() } as any)
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_key", sourceKey)
    .in("status", ["active", "paused"]);
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
