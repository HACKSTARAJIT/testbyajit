// Canonical taxonomy normalization for AI Chapters (Mock Mistakes).
// Pure functions — no DB, no AI. Used by ai-organize-mock for both fresh
// classification and the one-time "Normalize & Reorganize" pass.

/** Common alias map → canonical display name. */
const ALIASES: Record<string, string> = {
  "art culture": "Art & Culture",
  "arts culture": "Art & Culture",
  "culture": "Art & Culture",
  "science technology": "Science & Technology",
  "sci tech": "Science & Technology",
  "current affair": "Current Affairs",
  "currentaffairs": "Current Affairs",
  "general knowledge": "General Awareness",
  "gk": "General Awareness",
  "ga": "General Awareness",
  "general awareness": "General Awareness",
  "polity": "Indian Polity",
  "indian polity governance": "Indian Polity",
  "constitution": "Indian Polity",
  "economy": "Economics",
  "indian economy": "Economics",
  "economics": "Economics",
  "environment ecology": "Environment",
  "ecology": "Environment",
  "physic": "Physics",
  "science physic": "Physics",
  "chemistry": "Chemistry",
  "biology": "Biology",
  "maths": "Mathematics",
  "math": "Mathematics",
  "quantitative aptitude": "Quantitative Aptitude",
  "reasoning ability": "Reasoning",
  "logical reasoning": "Reasoning",
  "english language": "English",
  "static gk": "Static GK",
  "sport": "Sports",
  "government scheme": "Government Schemes",
  "book author": "Books & Authors",
  "international organisation": "International Organizations",
  "international organization": "International Organizations",
  "defence": "Defence",
  "defense": "Defence",
  "history": "History",
  "geography": "Geography",
  "triangle": "Triangles",
  "triangle problem": "Triangles",
};

const STOPWORDS = new Set(["the", "of", "in", "on", "a", "an", "for", "related", "based", "general", "misc", "miscellaneous", "questions", "question", "problems", "problem", "topics", "topic"]);

const UNCLASSIFIED = "Unclassified";

function singular(word: string): string {
  if (word.length > 3 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("ses")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Normalized comparison key: case/punctuation/plural insensitive. */
export function normKey(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(singular)
    .filter((w) => w !== "and")
    .join(" ");
}

function tokens(raw: string): string[] {
  return normKey(raw).split(" ").filter(Boolean);
}

function similarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function titleCase(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => (w.length <= 2 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .trim();
}

/**
 * Split combined names ("Current Affairs / Science & Technology",
 * "Science (Physics)", "Science - Physics") into ordered candidate segments.
 */
export function splitCombined(raw: string): string[] {
  const cleaned = (raw ?? "").replace(/[\[\]{}]/g, " ").trim();
  const parts = cleaned
    .split(/\s*[\/|;]\s*|\s+[–—-]\s+|\(|\)/g)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return parts.length ? parts : cleaned ? [cleaned] : [];
}

/** Clean a single raw label into consistent display style. */
function tidy(raw: string): string {
  const s = (raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+and\s+/gi, " & ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/["'`*#]/g, "")
    .trim()
    .slice(0, 60);
  if (!s) return "";
  return titleCase(s);
}

export type Taxonomy = {
  /** canonical chapter display names, per subject-agnostic pool */
  chapters: string[];
  /** chapter (normKey) → canonical topic display names */
  topics: Record<string, string[]>;
};

export function emptyTaxonomy(): Taxonomy {
  return { chapters: [], topics: {} };
}

/** Find an existing canonical name equivalent to `raw`, if any. */
function findExisting(raw: string, pool: string[]): string | null {
  const key = normKey(raw);
  if (!key) return null;
  for (const p of pool) if (normKey(p) === key) return p;
  let best: { name: string; score: number } | null = null;
  for (const p of pool) {
    const score = similarity(raw, p);
    if (score >= 0.6 && (!best || score > best.score)) best = { name: p, score };
  }
  return best?.name ?? null;
}

function applyAlias(raw: string): string {
  const key = normKey(raw);
  return ALIASES[key] ?? tidy(raw);
}

export type Classified = {
  subject: string;
  chapter: string;
  topic: string;
  subtopic: string | null;
};

/**
 * Canonicalize one AI/legacy classification against the taxonomy already
 * present for this user+subject. Reuses existing categories whenever the
 * meaning matches; only creates a new one when genuinely different.
 * Mutates `tax` so a batch converges on a single set of names.
 */
export function canonicalize(
  input: { subject?: string | null; chapter?: string | null; topic?: string | null; subtopic?: string | null },
  fallbackSubject: string,
  tax: Taxonomy,
): Classified {
  const subject = tidy(input.subject ?? "") || tidy(fallbackSubject) || "General";

  // --- chapter ---
  const chapterSegments = splitCombined(input.chapter ?? "");
  let chapter = "";
  let spillTopic = "";
  if (chapterSegments.length) {
    // Prefer a segment that already exists in the taxonomy.
    let chosenIdx = 0;
    for (let i = 0; i < chapterSegments.length; i++) {
      if (findExisting(chapterSegments[i], tax.chapters)) { chosenIdx = i; break; }
    }
    chapter = applyAlias(chapterSegments[chosenIdx]);
    const rest = chapterSegments.filter((_, i) => i !== chosenIdx);
    if (rest.length) spillTopic = applyAlias(rest[0]);
  }
  if (!chapter || normKey(chapter) === normKey(UNCLASSIFIED)) chapter = UNCLASSIFIED;
  const existingChapter = findExisting(chapter, tax.chapters);
  chapter = existingChapter ?? chapter;
  if (!tax.chapters.some((c) => c === chapter)) tax.chapters.push(chapter);

  // --- topic ---
  const chapterKey = normKey(chapter);
  const pool = (tax.topics[chapterKey] ??= []);
  const topicSegments = splitCombined(input.topic ?? "");
  let topic = topicSegments.length ? applyAlias(topicSegments[0]) : "";
  if (!topic) topic = spillTopic;
  if (!topic || normKey(topic) === chapterKey) topic = "General";
  const existingTopic = findExisting(topic, pool);
  topic = existingTopic ?? topic;
  if (!pool.includes(topic)) pool.push(topic);

  // --- subtopic ---
  let subtopic: string | null = null;
  const subSegments = splitCombined(input.subtopic ?? "");
  if (subSegments.length) {
    const s = tidy(subSegments[0]);
    if (s && normKey(s) !== normKey(topic) && normKey(s) !== chapterKey) subtopic = s;
  }
  if (!subtopic && topicSegments.length > 1) {
    const s = tidy(topicSegments[1]);
    if (s && normKey(s) !== normKey(topic)) subtopic = s;
  }

  return { subject, chapter, topic, subtopic };
}

/** Build the taxonomy from rows already stored in the DB. */
export function taxonomyFromRows(
  rows: Array<{ ai_chapter: string | null; ai_topic: string | null }>,
): Taxonomy {
  const tax = emptyTaxonomy();
  for (const r of rows) {
    const chapter = tidy(r.ai_chapter ?? "");
    if (!chapter) continue;
    if (!tax.chapters.includes(chapter)) tax.chapters.push(chapter);
    const key = normKey(chapter);
    const pool = (tax.topics[key] ??= []);
    const topic = tidy(r.ai_topic ?? "");
    if (topic && !pool.includes(topic)) pool.push(topic);
  }
  return tax;
}

/** Compact taxonomy text for the AI prompt. */
export function taxonomyPrompt(tax: Taxonomy): string {
  if (!tax.chapters.length) return "(no existing categories yet)";
  return tax.chapters
    .slice(0, 60)
    .map((c) => {
      const topics = (tax.topics[normKey(c)] ?? []).slice(0, 20);
      return `- ${c}${topics.length ? `: ${topics.join(", ")}` : ""}`;
    })
    .join("\n");
}

export const UNCLASSIFIED_CHAPTER = UNCLASSIFIED;
