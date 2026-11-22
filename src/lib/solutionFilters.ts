export type SolutionFilter = "all" | "correct" | "wrong" | "skipped";
export type SolutionQuestion = { id: string; correct_option: string };

export function solutionStatus(question: SolutionQuestion, answers: Readonly<Record<string, string>>) {
  const answer = answers[question.id];
  return !answer ? "skipped" : answer === question.correct_option ? "correct" : "wrong";
}

/** Returns original session indices, never renumbering or mutating the attempt. */
export function solutionIndices(
  questions: readonly SolutionQuestion[], answers: Readonly<Record<string, string>>, filter: SolutionFilter,
) {
  return questions.flatMap((question, index) =>
    filter === "all" || solutionStatus(question, answers) === filter ? [index] : [],
  );
}

export function adjacentSolutionIndex(indices: readonly number[], current: number, direction: -1 | 1) {
  const position = indices.indexOf(current);
  return position < 0 ? undefined : indices[position + direction];
}