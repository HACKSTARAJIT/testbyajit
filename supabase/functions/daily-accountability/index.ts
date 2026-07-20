import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { unifiedFetch } from "../_shared/unifiedAI.ts";
const MODEL = "google/gemini-2.5-flash";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDate = (d = new Date()) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const daysAgoIST = (n: number) => {
  const d = new Date(Date.now() - n * 86400000);
  return istDate(d);
};

function consistencyLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 40) return "Average";
  return "Poor";
}

function seriousnessLevel(pct: number, activeDays: number, revisionDays: number, mockDays: number) {
  // pct = 30-day avg completion, activeDays = days with any target in 30d
  const score =
    pct * 0.5 +
    Math.min(activeDays / 30, 1) * 100 * 0.25 +
    Math.min(revisionDays / 15, 1) * 100 * 0.15 +
    Math.min(mockDays / 8, 1) * 100 * 0.10;
  if (score >= 80) return { level: "Highly Committed", score: Math.round(score) };
  if (score >= 60) return { level: "Committed", score: Math.round(score) };
  if (score >= 35) return { level: "Needs More Discipline", score: Math.round(score) };
  return { level: "Irregular", score: Math.round(score) };
}

async function callAI(system: string, prompt: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "";
  const res = await unifiedFetch({ body: {
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    }, feature: "daily-accountability" });
  if (!res.ok) return "";
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "daily";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "daily") {
      const date = body?.date ?? istDate();
      const { data: targets } = await admin
        .from("daily_targets")
        .select("*")
        .eq("user_id", userId)
        .eq("target_date", date);

      const total = targets?.length ?? 0;
      const done = targets?.filter((t: any) => t.completed).length ?? 0;
      const pending = (targets ?? []).filter((t: any) => !t.completed).map((t: any) => t.title);
      const completedTitles = (targets ?? []).filter((t: any) => t.completed).map((t: any) => t.title);
      const highPriorityTotal = (targets ?? []).filter((t: any) => t.priority === "high").length;
      const highPriorityDone = (targets ?? []).filter((t: any) => t.priority === "high" && t.completed).length;

      // Study signals for the day
      const [{ data: attempts }, { data: activity }] = await Promise.all([
        admin.from("test_attempts").select("id,accuracy,status,completed_at,started_at")
          .eq("user_id", userId).gte("started_at", `${date}T00:00:00`).lte("started_at", `${date}T23:59:59`),
        admin.from("study_activity").select("item_type,opened_at")
          .eq("user_id", userId).gte("opened_at", `${date}T00:00:00`).lte("opened_at", `${date}T23:59:59`),
      ]);
      const mocksDone = (attempts ?? []).filter((a: any) => a.status === "completed").length;
      const activityCount = activity?.length ?? 0;

      // 30-day rollup for seriousness
      const since = daysAgoIST(29);
      const { data: hist } = await admin
        .from("daily_targets")
        .select("target_date,completed,category")
        .eq("user_id", userId)
        .gte("target_date", since);
      const perDay = new Map<string, { total: number; done: number; hasRevision: boolean; hasMock: boolean }>();
      (hist ?? []).forEach((r: any) => {
        const d = perDay.get(r.target_date) ?? { total: 0, done: 0, hasRevision: false, hasMock: false };
        d.total++;
        if (r.completed) d.done++;
        const c = (r.category ?? "").toLowerCase();
        if (c.includes("revis")) d.hasRevision = d.hasRevision || !!r.completed;
        if (c.includes("mock") || c.includes("test")) d.hasMock = d.hasMock || !!r.completed;
        perDay.set(r.target_date, d);
      });
      const dayPcts: number[] = [];
      let activeDays = 0, revisionDays = 0, mockDays = 0;
      perDay.forEach((v) => {
        if (v.total > 0) { activeDays++; dayPcts.push(Math.round((v.done / v.total) * 100)); }
        if (v.hasRevision) revisionDays++;
        if (v.hasMock) mockDays++;
      });
      const avg30 = dayPcts.length ? Math.round(dayPcts.reduce((s, x) => s + x, 0) / dayPcts.length) : 0;

      // Streak (consecutive days ending today with >=1 completed target)
      let streak = 0;
      for (let i = 0; i < 90; i++) {
        const d = daysAgoIST(i);
        const rec = perDay.get(d);
        if (rec && rec.done > 0) streak++; else break;
      }

      const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
      const hasHighPriority = highPriorityTotal > 0;
      const highPriorityPct = hasHighPriority ? Math.round((highPriorityDone / highPriorityTotal) * 100) : 100;

      const consistencyScore = Math.round(
        completionPct * 0.45 +
        highPriorityPct * 0.20 +
        Math.min(streak / 7, 1) * 100 * 0.15 +
        Math.min(mocksDone, 1) * 100 * 0.10 +
        Math.min(activityCount / 3, 1) * 100 * 0.10,
      );
      const cLabel = consistencyLabel(consistencyScore);
      const ser = seriousnessLevel(avg30, activeDays, revisionDays, mockDays);

      const reasons: string[] = [];
      if (completionPct >= 85) reasons.push(`Completed ${done}/${total} tasks today.`);
      else if (total > 0) reasons.push(`Only ${done}/${total} tasks completed today.`);
      if (hasHighPriority && highPriorityDone === highPriorityTotal) reasons.push("All high-priority work finished.");
      else if (hasHighPriority) reasons.push(`${highPriorityTotal - highPriorityDone} high-priority task(s) skipped.`);
      if (streak >= 3) reasons.push(`${streak}-day consistency streak.`);
      if (mocksDone > 0) reasons.push(`${mocksDone} mock test(s) attempted.`);
      if (activityCount === 0 && total > 0) reasons.push("No study material opened today.");

      const aiText = await callAI(
        "You are AJIT AI, an honest, motivating exam mentor. Never shame the student. Ground every statement in the numbers you are given. Reply in warm Hinglish (English mixed with simple Hindi). Return JSON only.",
        `Today's accountability snapshot for the student:
- Date: ${date}
- Tasks: ${done}/${total} completed
- Pending: ${JSON.stringify(pending)}
- Completed: ${JSON.stringify(completedTitles)}
- High priority: ${highPriorityDone}/${highPriorityTotal}
- Mocks attempted today: ${mocksDone}
- Study items opened today: ${activityCount}
- Streak: ${streak} day(s)
- 30-day avg completion: ${avg30}%, active days: ${activeDays}/30, revision days: ${revisionDays}, mock days: ${mockDays}
- Consistency score: ${consistencyScore} (${cLabel})
- Career Seriousness: ${ser.level}

Respond with strict JSON:
{"analysis":"2-3 sentence honest, specific analysis. Explain WHY (which tasks were done/skipped, patterns).","mentor_message":"1-2 sentence motivational message, honest, data-driven, never generic."}`,
      );
      let aiJson: any = {};
      try {
        const m = aiText.match(/\{[\s\S]*\}/);
        aiJson = m ? JSON.parse(m[0]) : {};
      } catch { /* ignore */ }

      const analysis = aiJson.analysis || reasons.join(" ") || "No targets set today.";
      const mentor_message = aiJson.mentor_message ||
        (completionPct >= 80 ? "Aaj ka discipline strong tha. Kal bhi yahi rhythm rakho." :
         completionPct > 0 ? "Aaj thoda gap raha — kal pending tasks pehle uthao." :
         "Kal ke liye 3 chhote, clear targets set karo. Consistency choti shuruaat se banti hai.");

      const { data: saved, error } = await admin.from("daily_reviews").upsert({
        user_id: userId,
        review_date: date,
        targets_total: total,
        targets_completed: done,
        consistency_score: consistencyScore,
        consistency_label: cLabel,
        seriousness_level: ser.level,
        seriousness_reasons: reasons,
        analysis,
        mentor_message,
        metrics: { highPriorityDone, highPriorityTotal, mocksDone, activityCount, streak, avg30, activeDays, revisionDays, mockDays, seriousnessScore: ser.score },
      }, { onConflict: "user_id,review_date" }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ review: saved });
    }

    if (action === "weekly" || action === "monthly") {
      const days = action === "weekly" ? 7 : 30;
      const since = daysAgoIST(days - 1);
      const [{ data: targets }, { data: reviews }] = await Promise.all([
        admin.from("daily_targets").select("*").eq("user_id", userId).gte("target_date", since),
        admin.from("daily_reviews").select("*").eq("user_id", userId).gte("review_date", since),
      ]);
      const total = targets?.length ?? 0;
      const completed = targets?.filter((t: any) => t.completed).length ?? 0;
      const missedByTitle: Record<string, number> = {};
      const doneByDate: Record<string, number> = {};
      const totalByDate: Record<string, number> = {};
      (targets ?? []).forEach((t: any) => {
        totalByDate[t.target_date] = (totalByDate[t.target_date] ?? 0) + 1;
        if (t.completed) doneByDate[t.target_date] = (doneByDate[t.target_date] ?? 0) + 1;
        else missedByTitle[t.title] = (missedByTitle[t.title] ?? 0) + 1;
      });
      const mostMissed = Object.entries(missedByTitle).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const dayPct = Object.keys(totalByDate).map((d) => ({
        date: d, pct: Math.round(((doneByDate[d] ?? 0) / totalByDate[d]) * 100),
      }));
      const mostConsistent = [...dayPct].sort((a, b) => b.pct - a.pct)[0] ?? null;
      const leastProductive = [...dayPct].sort((a, b) => a.pct - b.pct)[0] ?? null;
      const trend = (reviews ?? []).map((r: any) => ({ date: r.review_date, score: r.consistency_score }));
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return json({
        period: action,
        since,
        summary: {
          total, completed, completionRate,
          mostMissed, mostConsistent, leastProductive, trend,
        },
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
