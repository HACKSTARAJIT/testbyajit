// Canonical Subject → Chapter → Topic hierarchy for AI Chapters (Mock Mistakes).
// Pure functions — no DB, no AI. The AI only proposes labels; this module snaps
// those labels onto a stable hierarchy so Topics never become top-level Chapters.

import { normKey, splitCombined, type Taxonomy, canonicalize, type Classified } from "./taxonomy.ts";

type ChapterMap = Record<string, string[]>;

const MATHEMATICS: ChapterMap = {
  "Arithmetic": [
    "Percentage", "Ratio & Proportion", "Average", "Profit & Loss", "Discount",
    "Simple Interest", "Compound Interest", "Time & Work", "Pipes & Cisterns",
    "Time, Speed & Distance", "Trains", "Partnership", "Mixture & Alligation",
    "Boats & Streams", "Ages", "Simplification", "Approximation", "Percentage Change",
  ],
  "Number System": ["Divisibility", "HCF & LCM", "Remainder", "Factors", "Surds & Indices", "Fractions", "Unit Digit"],
  "Algebra": ["Equations", "Identities", "Polynomials", "Quadratic Equations", "Linear Equations", "Inequalities"],
  "Geometry": ["Triangles", "Circles", "Quadrilaterals", "Lines & Angles", "Polygons", "Coordinate Geometry", "Similarity & Congruence"],
  "Mensuration": ["2D Mensuration", "3D Mensuration", "Area", "Volume", "Surface Area"],
  "Trigonometry": ["Trigonometric Ratios", "Trigonometric Identities", "Height & Distance", "Trigonometric Equations"],
  "Data Interpretation": ["Bar Graph", "Pie Chart", "Line Graph", "Table Chart", "Statistics", "Mean, Median & Mode", "Probability"],
};

const ENGLISH: ChapterMap = {
  "Vocabulary": ["Synonyms", "Antonyms", "One Word Substitution", "Idioms & Phrases", "Spelling", "Homonyms", "Word Meaning"],
  "Grammar": [
    "Tenses", "Articles", "Prepositions", "Subject-Verb Agreement", "Active & Passive Voice",
    "Direct & Indirect Speech", "Nouns", "Pronouns", "Adjectives", "Adverbs", "Conjunctions",
    "Error Detection", "Sentence Improvement", "Narration", "Degrees Of Comparison",
  ],
  "Reading Comprehension": ["Passage Comprehension", "Inference", "Para Jumbles"],
  "Cloze Test": ["Cloze Passage", "Fill In The Blanks"],
  "Sentence/Usage": ["Sentence Rearrangement", "Sentence Completion", "Phrase Replacement", "Word Usage"],
};

const REASONING: ChapterMap = {
  "Verbal Reasoning": [
    "Analogy", "Classification", "Series", "Coding-Decoding", "Blood Relations",
    "Direction & Distance", "Ranking & Order", "Alphabet Test", "Word Formation", "Missing Number",
  ],
  "Non-Verbal Reasoning": ["Figure Series", "Mirror Image", "Water Image", "Paper Folding", "Embedded Figures", "Counting Figures", "Dice & Cubes"],
  "Logical Reasoning": ["Statement & Conclusion", "Statement & Assumption", "Syllogism", "Seating Arrangement", "Puzzles", "Venn Diagram", "Data Sufficiency", "Mathematical Operations"],
  "Miscellaneous Reasoning": ["Calendar", "Clock", "Matrix"],
};

const GENERAL_AWARENESS: ChapterMap = {
  "History": ["Ancient History", "Medieval History", "Modern History", "Freedom Struggle", "World History"],
  "Geography": ["Physical Geography", "Indian Geography", "World Geography", "Rivers", "Mountains", "Climate", "Agriculture", "Minerals & Resources"],
  "Indian Polity & Governance": [
    "Constitution", "Parliament", "Judiciary", "Central Government", "State Government",
    "Government Schemes", "Fundamental Rights", "Elections", "Panchayati Raj", "Amendments", "Local Government",
  ],
  "Science & Technology": [
    "Physics", "Chemistry", "Biology", "Artificial Intelligence", "Defence Technology",
    "Space Technology", "Computer", "Human Body", "Diseases", "Inventions & Discoveries",
  ],
  "Economics": ["Banking", "Budget", "Taxation", "National Income", "Inflation", "Financial Institutions", "Economic Survey"],
  "Environment & Ecology": ["Environment", "Ecology", "Climate Change", "Biodiversity", "Wildlife & Sanctuaries", "Pollution"],
  "Art & Culture": ["Music", "Dance", "Literature", "Architecture", "Festivals", "Painting", "Temples & Monuments", "Religion & Philosophy"],
  "Sports": ["Cricket", "Olympics", "Sports Awards", "Tournaments", "Sports Terms"],
  "Current Affairs": ["National", "International", "Awards & Honours", "Rankings", "Summits", "Appointments", "Obituaries", "Days & Themes"],
  "Books & Authors": ["Books & Authors"],
  "International Organizations": ["United Nations", "World Bank", "WHO", "Headquarters"],
  "Static GK": ["Important Days", "Dams & Projects", "Nicknames", "First In India", "Superlatives", "Currencies & Capitals"],
};

const SUBJECT_HIERARCHY: Record<string, ChapterMap> = {
  "mathematic": MATHEMATICS,
  "math": MATHEMATICS,
  "maths": MATHEMATICS,
  "quantitative aptitude": MATHEMATICS,
  "quantitative": MATHEMATICS,
  "english": ENGLISH,
  "english language": ENGLISH,
  "reasoning": REASONING,
  "general intelligence reasoning": REASONING,
  "general awareness": GENERAL_AWARENESS,
  "general knowledge": GENERAL_AWARENESS,
  "gk": GENERAL_AWARENESS,
  "ga": GENERAL_AWARENESS,
  "general studies": GENERAL_AWARENESS,
};

/** Extra label aliases → canonical topic name inside the same subject. */
const TOPIC_ALIASES: Record<string, string> = {
  "english vocabulary": "Vocabulary",
  "english grammar": "Grammar",
  "english comprehension": "Reading Comprehension",
  "comprehension": "Reading Comprehension",
  "idiom": "Idioms & Phrases",
  "phrase": "Idioms & Phrases",
  "synonym": "Synonyms",
  "antonym": "Antonyms",
  "spelling correction": "Spelling",
  "one word substitution": "One Word Substitution",
  "science": "Science & Technology",
  "science technology": "Science & Technology",
  "sci tech": "Science & Technology",
  "physic": "Physics",
  "polity": "Indian Polity & Governance",
  "indian polity": "Indian Polity & Governance",
  "governance": "Indian Polity & Governance",
  "government policy": "Government Schemes",
  "government scheme": "Government Schemes",
  "indian economy": "Economics",
  "economy": "Economics",
  "environment": "Environment & Ecology",
  "ecology": "Environment & Ecology",
  "art culture": "Art & Culture",
  "art and culture": "Art & Culture",
  "culture": "Art & Culture",
  "sport": "Sports",
  "current affair": "Current Affairs",
  "international organisation": "International Organizations",
  "international summit": "Summits",
  "mensuration": "Mensuration",
  "3d mensuration": "3D Mensuration",
  "2d mensuration": "2D Mensuration",
  "triangle": "Triangles",
  "triangle problem": "Triangles",
  "circle": "Circles",
  "ratio proportion": "Ratio & Proportion",
  "profit loss": "Profit & Loss",
  "time work": "Time & Work",
  "speed time distance": "Time, Speed & Distance",
  "time speed distance": "Time, Speed & Distance",
  "boat stream": "Boats & Streams",
  "mixture alligation": "Mixture & Alligation",
  "hcf lcm": "HCF & LCM",
  "number theory": "Number System",
  "simple interest": "Simple Interest",
  "compound interest": "Compound Interest",
  "coding decoding": "Coding-Decoding",
  "blood relation": "Blood Relations",
  "seating arrangement": "Seating Arrangement",
  "syllogism": "Syllogism",
  "mirror image": "Mirror Image",
  "series": "Series",
  "analogy": "Analogy",
};

export type Index = {
  chapters: Map<string, string>;               // normKey(chapter) → chapter
  topics: Map<string, { chapter: string; topic: string }>; // normKey(topic) → placement
};

const INDEX_CACHE = new Map<string, Index>();

function subjectKey(subject: string): string {
  const k = normKey(subject);
  if (SUBJECT_HIERARCHY[k]) return k;
  for (const key of Object.keys(SUBJECT_HIERARCHY)) {
    if (k.includes(key) || key.includes(k)) return key;
  }
  return "";
}

function buildIndex(map: ChapterMap): Index {
  const chapters = new Map<string, string>();
  const topics = new Map<string, { chapter: string; topic: string }>();
  for (const [chapter, list] of Object.entries(map)) {
    chapters.set(normKey(chapter), chapter);
    for (const topic of list) {
      const key = normKey(topic);
      if (!topics.has(key)) topics.set(key, { chapter, topic });
    }
  }
  // aliases that resolve to a known chapter or topic
  for (const [alias, target] of Object.entries(TOPIC_ALIASES)) {
    const tKey = normKey(target);
    if (topics.has(tKey) && !topics.has(alias)) topics.set(alias, topics.get(tKey)!);
    else if (chapters.has(tKey) && !chapters.has(alias)) chapters.set(alias, chapters.get(tKey)!);
  }
  return { chapters, topics };
}

export function hierarchyFor(subject: string): Index | null {
  const key = subjectKey(subject);
  if (!key) return null;
  if (!INDEX_CACHE.has(key)) INDEX_CACHE.set(key, buildIndex(SUBJECT_HIERARCHY[key]));
  return INDEX_CACHE.get(key)!;
}

/** Prompt text listing the canonical hierarchy for one subject. */
export function hierarchyPrompt(subject: string): string {
  const key = subjectKey(subject);
  if (!key) return "(no fixed hierarchy for this subject — use broad chapters and specific topics)";
  return Object.entries(SUBJECT_HIERARCHY[key])
    .map(([c, t]) => `- ${c}: ${t.join(", ")}`)
    .join("\n");
}

function tidyLabel(raw: string): string {
  return (raw ?? "").replace(/\s+/g, " ").replace(/\s+and\s+/gi, " & ").trim();
}

function labelsOf(...raw: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    for (const seg of splitCombined(r ?? "")) {
      const s = tidyLabel(seg);
      if (s && !out.some((o) => normKey(o) === normKey(s))) out.push(s);
    }
  }
  return out;
}

function lookupTopic(idx: Index, label: string) {
  const k = normKey(label);
  if (!k) return null;
  const direct = idx.topics.get(k);
  if (direct) return direct;
  const alias = TOPIC_ALIASES[k];
  if (alias) {
    const a = idx.topics.get(normKey(alias));
    if (a) return a;
  }
  return null;
}

function lookupChapter(idx: Index, label: string) {
  const k = normKey(label);
  if (!k) return null;
  const direct = idx.chapters.get(k);
  if (direct) return direct;
  const alias = TOPIC_ALIASES[k];
  if (alias) return idx.chapters.get(normKey(alias)) ?? null;
  return null;
}

/**
 * Snap AI/legacy labels onto the canonical Subject → Chapter → Topic → Sub-topic
 * hierarchy. Falls back to the taxonomy-based canonicalizer for subjects (or
 * concepts) outside the fixed hierarchy so nothing is ever lost.
 */
export function placeInHierarchy(
  input: { subject?: string | null; chapter?: string | null; topic?: string | null; subtopic?: string | null },
  fallbackSubject: string,
  tax: Taxonomy,
): Classified {
  const subject = tidyLabel(input.subject ?? "") || tidyLabel(fallbackSubject) || "General";
  const idx = hierarchyFor(subject) ?? hierarchyFor(fallbackSubject);
  if (!idx) return canonicalize(input, fallbackSubject, tax);

  const labels = labelsOf(input.chapter, input.topic, input.subtopic);

  let chapter = "";
  let topic = "";
  const used = new Set<string>();

  // 1) A label that is a known TOPIC decides both chapter and topic.
  for (const l of labels) {
    const hit = lookupTopic(idx, l);
    if (hit) { chapter = hit.chapter; topic = hit.topic; used.add(normKey(l)); break; }
  }
  // 2) Otherwise a label that is a known CHAPTER decides the chapter.
  if (!chapter) {
    for (const l of labels) {
      const hit = lookupChapter(idx, l);
      if (hit) { chapter = hit; used.add(normKey(l)); break; }
    }
  }

  if (!chapter) {
    // Nothing matched the fixed hierarchy — keep the old canonical behaviour so
    // genuinely new concepts still get a home instead of being dropped.
    return canonicalize(input, fallbackSubject, tax);
  }

  if (!topic) {
    const rest = labels.filter((l) => !used.has(normKey(l)));
    const chosen = rest[0];
    if (chosen) {
      const nested = lookupTopic(idx, chosen);
      topic = nested && nested.chapter === chapter ? nested.topic : tidyLabel(chosen);
      used.add(normKey(chosen));
    } else {
      topic = "General";
    }
  }

  // Sub-topic = first remaining distinct label.
  let subtopic: string | null = null;
  for (const l of labels) {
    const k = normKey(l);
    if (used.has(k) || !k) continue;
    if (k === normKey(chapter) || k === normKey(topic)) continue;
    if (lookupChapter(idx, l)) continue; // never nest a chapter name as sub-topic
    subtopic = tidyLabel(l).slice(0, 60);
    break;
  }

  // Keep the taxonomy in sync so later batches reuse the same names.
  if (!tax.chapters.includes(chapter)) tax.chapters.push(chapter);
  const pool = (tax.topics[normKey(chapter)] ??= []);
  if (!pool.includes(topic)) pool.push(topic);

  return { subject, chapter, topic, subtopic };
}
