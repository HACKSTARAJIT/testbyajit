// Pure functions that turn the student's existing Practice Book data into
// AI-Coach insights (memory engine, forgetting curve, learning style,
// insights, alerts, streak, greeting). No AI calls — deterministic locally.

export type CoachWrong = {
  id: string;
  chapter_id: string | null;
  subject_id: string | null;
  priority: string;
  status: string;
  wrong_count: number;
  correct_revision_count: number;
  consecutive_correct: number;
  last_attempt_at: string | null;
  mastered_at: string | null;
  topic: string | null;
};

export type CoachAttempt = {
  accuracy: number | null;
  marks_obtained: number | null;
  created_at: string;
};

export type ChapterRef = { id: string; name: string; subject_id: string };
export type SubjectRef = { id: string; name: string };

export function greeting(name: string) {
  const h = new Date().getHours();
  const tod = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  return `${tod}, ${name}`;
}

const DAY = 86400000;

/** Ebbinghaus-inspired retention: higher consecutive_correct → slower decay. */
function retentionPercent(daysSince: number, consecutiveCorrect: number) {
  const stability = Math.max(1.5, 2 + consecutiveCorrect * 2.5); // days
  const r = Math.exp(-daysSince / stability);
  return Math.round(r * 100);
}

export type MemoryItem = {
  id: string;
  label: string;
  daysSince: number;
  retention: number;
  risk: "low" | "medium" | "high" | "critical";
  action: string;
};

export function memoryEngine(
  wrongs: CoachWrong[],
  chapters: ChapterRef[],
) {
  const chapMap = new Map<string, ChapterRef>();
  chapters.forEach((c) => chapMap.set(c.id, c));

  // Aggregate per chapter for pending items
  const byChap = new Map<string, { chapter: ChapterRef; last: number; consec: number; count: number }>();
  wrongs.forEach((w) => {
    if (!w.chapter_id) return;
    if (w.status === "mastered") return;
    const ch = chapMap.get(w.chapter_id);
    if (!ch) return;
    const t = w.last_attempt_at ? +new Date(w.last_attempt_at) : Date.now() - 30 * DAY;
    const cur = byChap.get(w.chapter_id) ?? { chapter: ch, last: t, consec: w.consecutive_correct, count: 0 };
    cur.last = Math.min(cur.last, t);
    cur.consec = Math.min(cur.consec, w.consecutive_correct);
    cur.count += 1;
    byChap.set(w.chapter_id, cur);
  });

  const now = Date.now();
  const items: MemoryItem[] = [];
  byChap.forEach((v, id) => {
    const daysSince = Math.max(0, Math.round((now - v.last) / DAY));
    const retention = retentionPercent(daysSince, v.consec);
    const risk: MemoryItem["risk"] =
      retention < 20 ? "critical" : retention < 40 ? "high" : retention < 70 ? "medium" : "low";
    items.push({
      id,
      label: v.chapter.name,
      daysSince,
      retention,
      risk,
      action:
        risk === "critical" ? "Revise आज ही करें" :
        risk === "high" ? "अगले 2 दिन में Revision करें" :
        risk === "medium" ? "इस हफ्ते Revision plan करें" : "Memory मज़बूत है — अभी बस Practice",
    });
  });
  items.sort((a, b) => a.retention - b.retention);

  // Recently mastered chapters
  const masteredChap = new Map<string, number>();
  wrongs.forEach((w) => {
    if (w.status === "mastered" && w.mastered_at && w.chapter_id) {
      const t = +new Date(w.mastered_at);
      masteredChap.set(w.chapter_id, Math.max(masteredChap.get(w.chapter_id) ?? 0, t));
    }
  });
  const recentlyMastered = [...masteredChap.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, at]) => ({
      id, label: chapMap.get(id)?.name ?? "Chapter",
      daysAgo: Math.round((now - at) / DAY),
    }));

  const strength = items.length
    ? Math.round(items.reduce((s, i) => s + i.retention, 0) / items.length)
    : 100;

  return {
    strength, // 0-100 overall memory strength across weak chapters
    risky: items.filter((i) => i.risk === "high" || i.risk === "critical").slice(0, 8),
    forgetSoon: items.filter((i) => i.risk === "medium").slice(0, 6),
    urgent: items.filter((i) => i.risk === "critical").slice(0, 5),
    recentlyMastered,
    all: items,
  };
}

export type LearningInsight = { icon: "clock" | "trend" | "book" | "warn"; text: string };

export function learningStyle(attempts: CoachAttempt[]): LearningInsight[] {
  if (attempts.length < 3) return [];
  const insights: LearningInsight[] = [];

  // Time-of-day performance
  const buckets = { morning: [] as number[], afternoon: [] as number[], evening: [] as number[], night: [] as number[] };
  attempts.forEach((a) => {
    if (a.accuracy == null) return;
    const h = new Date(a.created_at).getHours();
    const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
    buckets[k].push(a.accuracy);
  });
  const avg = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
  const scored = Object.entries(buckets)
    .filter(([, xs]) => xs.length >= 2)
    .map(([k, xs]) => ({ k, avg: avg(xs) }))
    .sort((a, b) => b.avg - a.avg);
  if (scored.length >= 2) {
    const best = scored[0], worst = scored[scored.length - 1];
    if (best.avg - worst.avg >= 8) {
      insights.push({ icon: "clock", text: `${cap(best.k)} में आपकी Accuracy सबसे अच्छी है (${Math.round(best.avg)}%). ${cap(worst.k)} में performance कम है (${Math.round(worst.avg)}%) — heavy topics ${best.k} में पढ़ें।` });
    }
  }

  // Trend across last 5 attempts
  const recent = attempts.slice(0, 5).map((a) => a.accuracy ?? 0).filter((x) => x > 0);
  if (recent.length >= 3) {
    const first = recent[recent.length - 1], last = recent[0];
    const diff = last - first;
    if (Math.abs(diff) >= 5) {
      insights.push({ icon: "trend", text: diff > 0
        ? `पिछले ${recent.length} attempts में Accuracy ${Math.round(diff)}% बढ़ी है — यही momentum बनाए रखें।`
        : `पिछले ${recent.length} attempts में Accuracy ${Math.round(-diff)}% गिरी है — Revision पर focus बढ़ाएँ।` });
    }
  }

  return insights;
}

function cap(s: string) { return s[0].toUpperCase() + s.slice(1); }

export type Alert = { level: "info" | "warn" | "danger"; text: string };

export function coachAlerts(args: {
  wrongs: CoachWrong[];
  attempts: CoachAttempt[];
  memory: ReturnType<typeof memoryEngine>;
  lastReportAt: string | null;
  todayTasksDone: number;
  todayTasksTotal: number;
}): Alert[] {
  const out: Alert[] = [];
  const now = Date.now();

  // Ignored revision days
  const lastRevised = args.wrongs
    .map((w) => w.last_attempt_at ? +new Date(w.last_attempt_at) : 0)
    .reduce((m, t) => Math.max(m, t), 0);
  if (lastRevised > 0) {
    const days = Math.floor((now - lastRevised) / DAY);
    if (days >= 3) out.push({ level: days >= 7 ? "danger" : "warn", text: `आपने ${days} दिन से Revision नहीं किया — Smart Revision खोलें।` });
  }

  // Memory risk
  if (args.memory.urgent.length > 0) {
    out.push({ level: "danger", text: `${args.memory.urgent.length} Chapters पर Memory Risk critical है — आज ही Revise करें।` });
  } else if (args.memory.risky.length >= 3) {
    out.push({ level: "warn", text: `${args.memory.risky.length} Chapters की Memory कमज़ोर हो रही है।` });
  }

  // Missed today's target
  if (args.todayTasksTotal > 0 && args.todayTasksDone === 0) {
    out.push({ level: "warn", text: `आज का target अभी शुरू नहीं हुआ — पहला task complete करें।` });
  } else if (args.todayTasksTotal > 0 && args.todayTasksDone < args.todayTasksTotal / 2) {
    out.push({ level: "info", text: `आज का ${args.todayTasksDone}/${args.todayTasksTotal} tasks complete — momentum बनाए रखें।` });
  }

  // No recent mock
  if (args.lastReportAt) {
    const days = Math.floor((now - +new Date(args.lastReportAt)) / DAY);
    if (days >= 10) out.push({ level: "warn", text: `${days} दिन से कोई नया Mock analyze नहीं हुआ — एक Mock Test upload करें।` });
  }

  // Accuracy drop
  if (args.attempts.length >= 5) {
    const recent = args.attempts.slice(0, 3).map((a) => a.accuracy ?? 0);
    const older = args.attempts.slice(3, 7).map((a) => a.accuracy ?? 0);
    const avg = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
    const diff = avg(recent) - avg(older);
    if (diff <= -8) out.push({ level: "danger", text: `हाल की Accuracy ${Math.round(-diff)}% गिरी है — कमज़ोर Chapters revise करें।` });
  }

  return out;
}

export type Insight = { text: string };

export function personalInsights(args: {
  wrongs: CoachWrong[];
  chapters: ChapterRef[];
  subjects: SubjectRef[];
  attempts: CoachAttempt[];
}): Insight[] {
  const out: Insight[] = [];
  const chapById = new Map(args.chapters.map((c) => [c.id, c]));
  const subById = new Map(args.subjects.map((s) => [s.id, s]));

  // Repeated mistakes per chapter
  const chapCount = new Map<string, { name: string; total: number }>();
  args.wrongs.forEach((w) => {
    if (!w.chapter_id) return;
    const ch = chapById.get(w.chapter_id);
    if (!ch) return;
    const cur = chapCount.get(w.chapter_id) ?? { name: ch.name, total: 0 };
    cur.total += (w.wrong_count ?? 1);
    chapCount.set(w.chapter_id, cur);
  });
  const topRepeat = [...chapCount.values()].sort((a, b) => b.total - a.total).slice(0, 2);
  topRepeat.forEach((c) => {
    if (c.total >= 3) out.push({ text: `आप ${c.name} में बार-बार marks खो रहे हैं (कुल ${c.total} गलतियाँ)।` });
  });

  // Subject avoided
  const subLastAttempt = new Map<string, number>();
  args.wrongs.forEach((w) => {
    if (!w.subject_id || !w.last_attempt_at) return;
    const t = +new Date(w.last_attempt_at);
    subLastAttempt.set(w.subject_id, Math.max(subLastAttempt.get(w.subject_id) ?? 0, t));
  });
  const now = Date.now();
  [...subLastAttempt.entries()].forEach(([sid, t]) => {
    const days = Math.floor((now - t) / DAY);
    if (days >= 7) {
      const s = subById.get(sid);
      if (s) out.push({ text: `आप ${s.name} avoid कर रहे हैं — ${days} दिन से practice नहीं की।` });
    }
  });

  // Revision improving accuracy
  const rev = args.wrongs.filter((w) => (w.correct_revision_count ?? 0) > 0);
  if (rev.length >= 5) {
    out.push({ text: `${rev.length} Questions Revision से सुधर चुके हैं — Smart Revision आपके लिए काम कर रहा है।` });
  }

  return out.slice(0, 6);
}

export function currentStreak(attempts: CoachAttempt[], tasksByDate: Map<string, { done: number; total: number }>): number {
  const days = new Set<string>();
  attempts.forEach((a) => days.add(a.created_at.slice(0, 10)));
  tasksByDate.forEach((v, k) => { if (v.done > 0) days.add(k); });
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) streak++;
    else if (i > 0) break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
