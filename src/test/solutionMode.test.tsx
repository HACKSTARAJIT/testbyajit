import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TestEngine } from "@/components/TestEngine";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/components/test-ui/TopAccuracyRanking", () => ({ TopAccuracyRanking: () => null }));
vi.mock("@/components/test-ui/RepeatMistakePanel", () => ({ RepeatMistakePanel: () => null }));

afterEach(cleanup);

describe("Solution Mode navigation", () => {
  it("opens first matching question, restricts next/previous and hides content for an empty filter", async () => {
    window.scrollTo = vi.fn();
    const questions = Array.from({ length: 4 }, (_, i) => ({
      id: `q${i + 1}`, question_text: `Question content ${i + 1}`,
      option_a: "Answer A", option_b: "Answer B", option_c: "Answer C", option_d: "Answer D", correct_option: "A",
    }));
    render(<MemoryRouter><TestEngine
      test={{ id: "test", title: "Filter test" }} questions={questions} mode="practice" isPreview
      saveAttempt={false} autoRecord={false} onExit={vi.fn()}
      resume={{ attemptId: "preview", current_index: 3, marked: {}, answers: { q1: "A", q2: "B", q3: "A", q4: "B" } }}
    /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Submit Test" }));
    fireEvent.click(await screen.findByRole("button", { name: "📖 View Solution" }));
    fireEvent.click(screen.getByRole("button", { name: "Wrong 2" }));
    expect(screen.getByText("1 of 2 Wrong Questions · Original Question: 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 of 2 Wrong Questions · Original Question: 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(screen.getByText("1 of 2 Wrong Questions · Original Question: 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Correct 2" }));
    expect(screen.getByText("1 of 2 Correct Questions · Original Question: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skipped 0" }));
    expect(screen.getAllByText("No questions found in this category.")).toHaveLength(2);
    expect(screen.queryByText("Question content 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "All 4" }));
    await waitFor(() => expect(screen.getByText("Question content 1")).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /^Question \d, / })).toHaveLength(4);
  });

  it("opens only the selected completed attempt with stored stats and no database writes", async () => {
    window.scrollTo = vi.fn();
    vi.mocked(supabase.from).mockClear();
    const questions = Array.from({ length: 3 }, (_, i) => ({
      id: `q${i + 1}`, question_text: `Question content ${i + 1}`,
      option_a: "Answer A", option_b: "Answer B", option_c: "Answer C", option_d: "Answer D", correct_option: "A",
    }));
    const reviewAttempt = {
      id: "attempt-1", attemptNumber: 1, test_id: "test", user_id: "user", status: "completed", mode: "practice" as const,
      answers: { q1: "B", q2: "A" }, marked: {}, guesses: {}, correct_count: 1, incorrect_count: 1,
      unattempted_count: 1, skipped_count: 1, marks_obtained: 1, total_questions: 3, accuracy: 50,
      time_taken_seconds: 125, current_index: 2, shuffle_mode: false,
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:02:05Z",
    };
    render(<MemoryRouter><TestEngine
      test={{ id: "test", title: "Historical test" }} questions={questions} mode="practice" userId="user"
      reviewAttempt={reviewAttempt} onExit={vi.fn()}
    /></MemoryRouter>);

    const summary = within(screen.getByTestId("solution-attempt-summary"));
    expect(summary.getByText("Attempt 1")).toBeInTheDocument();
    expect(summary.getByText("1/3")).toBeInTheDocument();
    expect(summary.getByText("50%")).toBeInTheDocument();
    expect(summary.getByText("02:05")).toBeInTheDocument();
    expect(screen.getByText("Question content 1")).toBeInTheDocument();
    expect(screen.getByText("❌ B")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Answer/ }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Correct 1" }));
    expect(screen.getByText("Question content 2")).toBeInTheDocument();
    expect(screen.getAllByText("✅ A").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Skipped 1" }));
    expect(screen.getByText("Question content 3")).toBeInTheDocument();
    expect(screen.getAllByText("⚪ Skipped").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Wrong 1" }));
    expect(screen.getByText("Question content 1")).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});