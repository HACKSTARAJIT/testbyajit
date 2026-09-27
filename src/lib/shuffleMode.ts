/**
 * Optional Shuffle Mode — presentation-only randomisation.
 *
 * Nothing here touches stored data: question IDs, option texts, correct answers
 * and explanations stay exactly as saved. We only change the ORDER in which
 * questions are displayed and the ORDER in which the existing options are shown.
 * Selected answers are always kept in the ORIGINAL option-letter space, so
 * scoring, review, AI analysis, wrong-question tracking and history are unchanged.
 */

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
export type OptionLetter = (typeof OPTION_LETTERS)[number];

/** Unbiased Fisher–Yates shuffle on a copy of the array. */
export function shuffleArray<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Stable display order for a saved attempt; never changes the underlying questions. */
export function shuffleForAttempt<T>(items: T[], seed: string): T[] {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Display order of ORIGINAL option letters per question id.
 * `shuffle=false` → ["A","B","C","D"] for every question (original positions).
 */
export function buildOptionOrder(
  ids: string[],
  shuffle: boolean,
  seed?: string,
): Record<string, OptionLetter[]> {
  const map: Record<string, OptionLetter[]> = {};
  for (const id of ids) {
    map[id] = shuffle ? (seed ? shuffleForAttempt([...OPTION_LETTERS], `${seed}:${id}`) : shuffleArray([...OPTION_LETTERS])) : [...OPTION_LETTERS];
  }
  return map;
}

/** Letter shown to the student for an original letter, given a display order. */
export function displayLetter(order: OptionLetter[] | undefined, original: string): string {
  if (!order) return original;
  const i = order.indexOf(original as OptionLetter);
  return i >= 0 ? OPTION_LETTERS[i] : original;
}
