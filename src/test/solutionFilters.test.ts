import { describe, expect, it } from "vitest";
import { adjacentSolutionIndex, solutionIndices, solutionStatus } from "@/lib/solutionFilters";

describe("Solution Mode filtering", () => {
  const questions = Array.from({ length: 210 }, (_, i) => ({ id: `q${i + 1}`, correct_option: "A" }));
  const answers = Object.fromEntries(questions.map((q, i) => [q.id, i < 160 ? "A" : "B"]));

  it("shows exactly 160 correct submitted answers", () => {
    expect(solutionIndices(questions, answers, "correct")).toHaveLength(160);
  });
  it("shows exactly 50 wrong attempted answers", () => {
    expect(solutionIndices(questions, answers, "wrong")).toHaveLength(50);
  });
  it("returns no skipped questions for a fully answered attempt", () => {
    expect(solutionIndices(questions, answers, "skipped")).toEqual([]);
  });
  it("restores all 210 original indices", () => {
    expect(solutionIndices(questions, answers, "all")).toEqual(Array.from({ length: 210 }, (_, i) => i));
  });
  it("preserves Q3, Q7, Q12 and Q18 rather than renumbering", () => {
    const submitted = Object.fromEntries(questions.map((q, i) => [q.id, [2, 6, 11, 17].includes(i) ? "B" : "A"]));
    expect(solutionIndices(questions, submitted, "wrong")).toEqual([2, 6, 11, 17]);
  });
  it("Previous and Next stay within the selected filter and stop at its edges", () => {
    const indices = [2, 6, 11, 17];
    expect(adjacentSolutionIndex(indices, 6, 1)).toBe(11);
    expect(adjacentSolutionIndex(indices, 6, -1)).toBe(2);
    expect(adjacentSolutionIndex(indices, 2, -1)).toBeUndefined();
    expect(adjacentSolutionIndex(indices, 17, 1)).toBeUndefined();
    expect(adjacentSolutionIndex([], 0, 1)).toBeUndefined();
  });
  it("classifies absent answers as skipped, never wrong", () => {
    expect(solutionStatus(questions[0], {})).toBe("skipped");
    expect(solutionIndices(questions.slice(0, 3), { q1: "A", q2: "B" }, "skipped")).toEqual([2]);
  });
  it("never modifies questions or saved answers", () => {
    const frozenQuestions = Object.freeze(questions.map(q => Object.freeze({ ...q })));
    const frozenAnswers = Object.freeze({ ...answers });
    for (const filter of ["all", "correct", "wrong", "skipped"] as const) solutionIndices(frozenQuestions, frozenAnswers, filter);
    expect(frozenQuestions).toEqual(questions);
    expect(frozenAnswers).toEqual(answers);
  });
});