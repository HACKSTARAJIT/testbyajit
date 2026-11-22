import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TestEngine } from "@/components/TestEngine";

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
});