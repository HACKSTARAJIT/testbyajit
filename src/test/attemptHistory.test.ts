import { describe, expect, it } from "vitest";
import { completedAttemptHistory, formatAttemptTime, type TestAttemptRecord } from "@/lib/attemptHistory";

function attempt(index: number, status = "completed"): TestAttemptRecord {
  return {
    id: `attempt-${String(index).padStart(3, "0")}`,
    test_id: "test-1",
    user_id: "user-1",
    status,
    mode: "practice",
    answers: {},
    marked: {},
    guesses: {},
    correct_count: index,
    incorrect_count: 0,
    unattempted_count: 0,
    skipped_count: 0,
    marks_obtained: index,
    total_questions: 100,
    accuracy: index,
    time_taken_seconds: index,
    current_index: 0,
    shuffle_mode: false,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    updated_at: new Date(Date.UTC(2026, 0, 1, 1, index)).toISOString(),
  };
}

describe("permanent attempt history", () => {
  it("keeps every completed attempt, numbers by start order and displays newest first", () => {
    const history = completedAttemptHistory(Array.from({ length: 60 }, (_, i) => attempt(i + 1)));
    expect(history).toHaveLength(60);
    expect(history[0]).toMatchObject({ id: "attempt-060", attemptNumber: 60 });
    expect(history[59]).toMatchObject({ id: "attempt-001", attemptNumber: 1 });
  });

  it("keeps incomplete attempts out of completed history", () => {
    const history = completedAttemptHistory([attempt(1), attempt(2, "in_progress"), attempt(3)]);
    expect(history.map((item) => item.attemptNumber)).toEqual([2, 1]);
    expect(history.map((item) => item.id)).toEqual(["attempt-003", "attempt-001"]);
  });

  it("formats short and multi-hour attempt times without losing seconds", () => {
    expect(formatAttemptTime(125)).toBe("02:05");
    expect(formatAttemptTime(12044)).toBe("3:20:44");
  });
});
