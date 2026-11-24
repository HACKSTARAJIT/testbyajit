export type AttemptMode = "practice" | "exam";

export type TestAttemptRecord = {
  id: string;
  test_id: string;
  user_id?: string;
  status: string;
  mode: AttemptMode;
  answers: Record<string, string> | null;
  marked: Record<string, "review" | "doubt"> | null;
  guesses: Record<string, { guess: true; selected: string; timeMs: number }> | null;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  skipped_count: number;
  marks_obtained: number;
  total_questions: number;
  accuracy: number;
  time_taken_seconds: number;
  current_index: number;
  shuffle_mode: boolean;
  created_at: string;
  updated_at: string;
};

export type NumberedAttempt = TestAttemptRecord & { attemptNumber: number };

export function attemptCompletedAt(attempt: TestAttemptRecord) {
  return attempt.updated_at || attempt.created_at;
}

/** Attempt numbers follow first-started order; cards are displayed newest first. */
export function completedAttemptHistory(attempts: TestAttemptRecord[]): NumberedAttempt[] {
  return attempts
    .filter((attempt) => attempt.status === "completed")
    .sort((a, b) =>
      +new Date(a.created_at) - +new Date(b.created_at) || a.id.localeCompare(b.id)
    )
    .map((attempt, index) => ({ ...attempt, attemptNumber: index + 1 }))
    .sort((a, b) =>
      +new Date(attemptCompletedAt(b)) - +new Date(attemptCompletedAt(a)) ||
      b.attemptNumber - a.attemptNumber
    );
}

export function formatAttemptTime(seconds?: number | null) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
