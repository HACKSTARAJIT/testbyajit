export interface ParsedQuestion {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D" | "";
  explanation: string;
}

const OPTION_RE = /^\s*[\(\[]?\s*([A-Da-d])\s*[\.\)\:\-–]\s+(.*)$/;
const OPTION_NUM_RE = /^\s*[\(\[]?\s*([1-4])\s*[\.\)\:\-–]\s+(.*)$/;
const ANSWER_RE = /^\s*(?:ans(?:wer)?|correct\s*answer|correct\s*option|right\s*answer|सही\s*उत्तर|उत्तर)\s*[:\-.=]?\s*[\(\[]?\s*([A-Da-d1-4])/i;
const EXPLANATION_RE = /^\s*(?:explanation|explaination|expl|reason|solution|sol|व्याख्या|हल|कारण)\s*[:\-.=]?\s*(.*)$/i;
const QNUM_RE = /^\s*(?:Q(?:ues(?:tion)?)?\s*)?\.?\s*\d{1,4}\s*[\.\)\:\-–]\s*/i;

const LETTERS = ["A", "B", "C", "D"] as const;

function normalizeCorrect(raw: string): ParsedQuestion["correct_option"] {
  const v = raw.trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(v)) return v as any;
  if (["1", "2", "3", "4"].includes(v)) return LETTERS[Number(v) - 1];
  return "";
}

/**
 * Parse plain text containing MCQs in the common numbered format.
 * Preserves the original order and supports very large inputs.
 */
export function parseMCQs(text: string): ParsedQuestion[] {
  const rawLines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim());

  const questions: ParsedQuestion[] = [];
  let cur: (ParsedQuestion & { _opts: string[] }) | null = null;
  let lastTarget: "question" | "option" | "explanation" | null = null;

  const push = () => {
    if (!cur) return;
    if (cur.question.trim() && cur._opts.filter(Boolean).length >= 2) {
      cur.option_a = cur._opts[0] ?? "";
      cur.option_b = cur._opts[1] ?? "";
      cur.option_c = cur._opts[2] ?? "";
      cur.option_d = cur._opts[3] ?? "";
      const { _opts, ...rest } = cur;
      questions.push(rest);
    }
    cur = null;
  };

  const startNew = (line: string) => {
    push();
    cur = {
      question: line.replace(QNUM_RE, "").trim(),
      option_a: "", option_b: "", option_c: "", option_d: "",
      correct_option: "", explanation: "", _opts: [],
    };
    lastTarget = "question";
  };

  for (const line of rawLines) {
    if (!line) continue;

    // Answer line
    const ansM = line.match(ANSWER_RE);
    if (ansM && cur && cur._opts.length > 0) {
      cur.correct_option = normalizeCorrect(ansM[1]);
      lastTarget = null;
      continue;
    }

    // Explanation line
    const expM = line.match(EXPLANATION_RE);
    if (expM && cur && cur._opts.length > 0) {
      cur.explanation = (cur.explanation ? cur.explanation + " " : "") + expM[1].trim();
      lastTarget = "explanation";
      continue;
    }

    // Option line (letter)
    const optM = line.match(OPTION_RE);
    if (optM && cur && cur.question) {
      const idx = optM[1].toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < 4) {
        cur._opts[idx] = optM[2].trim();
        lastTarget = "option";
        continue;
      }
    }
    // Option line (numeric 1-4) only if we already have a question but not yet 4 opts
    const optN = line.match(OPTION_NUM_RE);
    if (optN && cur && cur.question && cur._opts.length < 4) {
      const idx = Number(optN[1]) - 1;
      if (idx >= 0 && idx < 4 && !cur._opts[idx]) {
        cur._opts[idx] = optN[2].trim();
        lastTarget = "option";
        continue;
      }
    }

    // Plain line: decide question start vs continuation
    if (!cur) {
      startNew(line);
    } else if (cur.correct_option || (cur._opts.length >= 2 && lastTarget === null)) {
      // previous question complete -> new question
      startNew(line);
    } else if (lastTarget === "question" && cur._opts.length === 0) {
      cur.question += " " + line;
    } else if (lastTarget === "explanation") {
      cur.explanation += " " + line;
    } else if (lastTarget === "option") {
      const li = cur._opts.length - 1;
      if (li >= 0) cur._opts[li] += " " + line;
    } else {
      startNew(line);
    }
  }
  push();

  return questions;
}
