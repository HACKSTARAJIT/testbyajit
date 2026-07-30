export const MOCK_MISTAKE_SUBJECTS = [
  { key: "Mathematics", emoji: "📘" },
  { key: "English", emoji: "📗" },
  { key: "Reasoning", emoji: "📙" },
  { key: "General Awareness", emoji: "📕" },
] as const;

export const IMPORT_TEMPLATE = `Question:
....
A.
B.
C.
D.
Correct Answer:
...
My Answer:
...
Chapter:
...
Topic:
...
Explanation:
...

------------------------------------

Question:
....
A.
B.
C.
D.
Correct Answer:
...
My Answer:
...
Chapter:
...
Topic:
...
Explanation:
...`;

export interface ParsedMockMistake {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  user_answer: string;
  chapter: string;
  topic: string;
  explanation: string;
}

const FIELD_RE =
  /^\s*(question|correct\s*answer|my\s*answer|chapter|topic|explanation)\s*:\s*(.*)$/i;
const OPTION_RE = /^\s*\(?([A-Da-d])\)?\s*[.)\-:]\s*(.*)$/;

function normAnswer(raw: string): string {
  const v = raw.trim();
  const m = v.match(/^\(?([A-Da-d1-4])\)?[.)\s]*$/);
  if (m) {
    const c = m[1].toUpperCase();
    if (["1", "2", "3", "4"].includes(c)) return ["A", "B", "C", "D"][Number(c) - 1];
    return c;
  }
  const lead = v.match(/^\(?([A-Da-d])\)?\s*[.)\-:]\s+/);
  if (lead) return lead[1].toUpperCase();
  return v;
}

/** Parse the fixed bulk import format into individual question records. */
export function parseMockMistakes(text: string): ParsedMockMistake[] {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*-{3,}\s*\n|\n\s*={3,}\s*\n/)
    .flatMap((b) => (/(^|\n)\s*question\s*:/i.test(b) ? [b] : []));

  // If separators are missing, split on "Question:" occurrences instead.
  const chunks: string[] =
    blocks.length > 0
      ? blocks.flatMap((b) => splitOnQuestion(b))
      : splitOnQuestion(text.replace(/\r\n?/g, "\n"));

  const out: ParsedMockMistake[] = [];
  for (const chunk of chunks) {
    const q = parseBlock(chunk);
    if (q && q.question_text.trim()) out.push(q);
  }
  return out;
}

function splitOnQuestion(block: string): string[] {
  const lines = block.split("\n");
  const parts: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (/^\s*question\s*:/i.test(line)) {
      if (cur.length) parts.push(cur.join("\n"));
      cur = [line];
    } else if (cur.length) {
      cur.push(line);
    }
  }
  if (cur.length) parts.push(cur.join("\n"));
  return parts;
}

function parseBlock(block: string): ParsedMockMistake | null {
  const q: ParsedMockMistake = {
    question_text: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "",
    user_answer: "",
    chapter: "",
    topic: "",
    explanation: "",
  };
  let field: keyof ParsedMockMistake | null = null;

  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const f = line.match(FIELD_RE);
    if (f) {
      const key = f[1].toLowerCase().replace(/\s+/g, "");
      const val = f[2].trim();
      if (key === "question") { field = "question_text"; q.question_text = val; }
      else if (key === "correctanswer") { field = "correct_answer"; q.correct_answer = val; }
      else if (key === "myanswer") { field = "user_answer"; q.user_answer = val; }
      else if (key === "chapter") { field = "chapter"; q.chapter = val; }
      else if (key === "topic") { field = "topic"; q.topic = val; }
      else if (key === "explanation") { field = "explanation"; q.explanation = val; }
      continue;
    }

    const o = line.match(OPTION_RE);
    if (o && (field === "question_text" || field === null || field?.startsWith("option"))) {
      const idx = o[1].toUpperCase();
      const key = (`option_${idx.toLowerCase()}`) as keyof ParsedMockMistake;
      q[key] = o[2].trim();
      field = key;
      continue;
    }

    if (field) {
      q[field] = q[field] ? `${q[field]} ${line}` : line;
    }
  }

  q.correct_answer = normAnswer(q.correct_answer);
  q.user_answer = normAnswer(q.user_answer);
  if (!q.question_text.trim()) return null;
  return q;
}
