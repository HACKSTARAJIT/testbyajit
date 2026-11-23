import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CELEBRATION_DURATION, FIREWORKS_SOUND_KEY, useAnswerCelebration } from "@/hooks/useAnswerCelebration";

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Practice answer celebration rules", () => {
  it("reacts once to a newly correct answer and cleans up at 1400ms", () => {
    const { result } = renderHook(() => useAnswerCelebration("q1"));
    act(() => result.current.trigger("q1", true));
    expect(result.current.reaction).toEqual({ questionId: "q1", correct: true });
    expect(CELEBRATION_DURATION).toBe(1400);
    act(() => vi.advanceTimersByTime(1400));
    expect(result.current.reaction).toBeNull();
    act(() => result.current.trigger("q1", true));
    expect(result.current.reaction).toBeNull();
  });
  it("reports wrong feedback without a correct celebration", () => {
    const { result } = renderHook(() => useAnswerCelebration("q1"));
    act(() => result.current.trigger("q1", false));
    expect(result.current.reaction?.correct).toBe(false);
  });
  it("does not replay when navigating back to an answered question", () => {
    const { result, rerender } = renderHook(({ id }) => useAnswerCelebration(id), { initialProps: { id: "q1" } });
    act(() => result.current.trigger("q1", true));
    rerender({ id: "q2" });
    expect(result.current.reaction).toBeNull();
    rerender({ id: "q1" });
    expect(result.current.reaction).toBeNull();
    act(() => result.current.trigger("q1", true));
    expect(result.current.reaction).toBeNull();
  });
  it("never reacts when disabled for Exam or Solution Mode", () => {
    const { result } = renderHook(() => useAnswerCelebration("q1", false));
    act(() => result.current.trigger("q1", true));
    expect(result.current.reaction).toBeNull();
    act(() => result.current.trigger("q1", false));
    expect(result.current.reaction).toBeNull();
  });
  it("does not celebrate a restored answer on mount", () => {
    const { result } = renderHook(() => useAnswerCelebration("restored"));
    expect(result.current.reaction).toBeNull();
  });
  it("resets the event guard for a new practice attempt", () => {
    const { result } = renderHook(() => useAnswerCelebration("q1"));
    act(() => result.current.trigger("q1", true));
    act(() => result.current.reset());
    act(() => result.current.trigger("q1", true));
    expect(result.current.reaction?.correct).toBe(true);
  });
  it("defaults sound off and persists explicit opt-in and opt-out", () => {
    const { result } = renderHook(() => useAnswerCelebration("q1"));
    expect(result.current.soundEnabled).toBe(false);
    act(() => result.current.toggleSound());
    expect(localStorage.getItem(FIREWORKS_SOUND_KEY)).toBe("on");
    act(() => result.current.toggleSound());
    expect(result.current.soundEnabled).toBe(false);
    expect(localStorage.getItem(FIREWORKS_SOUND_KEY)).toBe("off");
  });
});