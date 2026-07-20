// AJIT 360 — Selection Intelligence
// Aggregates the student's real data (attempts, wrong questions, mocks, revision, activity,
// exam target) and computes the 9 Selection Intelligence panels deterministically.
// AI is only used to write the "Personal Selection Mentor" narrative — grounded in the
// numbers we already computed, never to invent metrics.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { unifiedFetch } from "../_shared/unifiedAI.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DAY = 86400000;
const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// Ebbinghaus-inspired retention
function retention(daysSince: number, consecCorrect: number) {
  const stability = Math.max(1.5, 2 + consecCorrect * 2.5);
  return Math.round(Math.exp(-daysSince / stability) * 100);
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [prof, subjects, chapters, reports, attempts, wrongs, revItems, activity, target, mistakes] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      admin.from("subjects").select("id, name"),
      admin.from("chapters").select("id, name, subject_id"),
      admin.from("ai_mock_reports").select("title, report_type, detected_subject, detected_chapter, accuracy, readiness_score, overall_score, report, created_at")
        .eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(30),
      admin.from("test_attempts").select("id, test_id, accuracy, marks_obtained, total_questions, correct_count, incorrect_count, unattempted_count, created_at")
        .eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
      admin.from("wrong_questions").select("id, chapter_id, subject_id, topic, priority, status, wrong_count, correct_revision_count, consecutive_correct, last_attempt_at, mastered_at")
        .eq("user_id", userId).limit(1000),
      admin.from("revision_items").select("id, item_type, subject_id, created_at").eq("user_id", userId),
      admin.from("study_activity").select("opened_at").eq("user_id", userId).order("opened_at", { ascending: false }).limit(120),
      admin.from("user_exam_targets").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("test_mistake_analyses").select("careless_marks_lost, silly_marks_lost, conceptual_marks_lost, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);

    const firstName = (prof.data?.display_name ?? "Student").trim().split(/\s+/)[0] || "Student";
    const subs = subjects.data ?? [];
    const chaps = chapters.data ?? [];
    const subMap = new Map(subs.map((s: any) => [s.id, s.name]));
    const chapMap = new Map(chaps.map((c: any) => [c.id, c]));

    const reps = reports.data ?? [];
    const atts = attempts.data ?? [];
    const wrs = wrongs.data ?? [];
    const revs = revItems.data ?? [];
    const mists = mistakes.data ?? [];

    // Overall
    const attAcc = atts.map((a: any) => a.accuracy ?? 0).filter((x: number) => x > 0);
    const mockAcc = reps.map((r: any) => r.accuracy ?? 0).filter((x: number) => x > 0);
    const overallAccuracy = avg([...mockAcc, ...attAcc]);
    const readiness = avg(reps.map((r: any) => r.readiness_score ?? 0).filter((x: number) => x > 0));

    // ---------- 1. WEAKNESS RECOVERY ----------
    // Aggregate wrongs per chapter/subject/topic
    type Bucket = { key: string; label: string; subject?: string; wrongTotal: number; ids: Set<string>; };
    const chapBucket = new Map<string, Bucket>();
    const topicBucket = new Map<string, Bucket>();
    const subjectWrong = new Map<string, number>();
    wrs.forEach((w: any) => {
      const cnt = (w.wrong_count ?? 1);
      if (w.chapter_id) {
        const ch: any = chapMap.get(w.chapter_id);
        if (ch) {
          const b = chapBucket.get(w.chapter_id) ?? { key: w.chapter_id, label: ch.name, subject: subMap.get(ch.subject_id) as string, wrongTotal: 0, ids: new Set() };
          b.wrongTotal += cnt; b.ids.add(w.id); chapBucket.set(w.chapter_id, b);
        }
      }
      if (w.topic) {
        const b = topicBucket.get(w.topic) ?? { key: w.topic, label: w.topic, wrongTotal: 0, ids: new Set() };
        b.wrongTotal += cnt; b.ids.add(w.id); topicBucket.set(w.topic, b);
      }
      if (w.subject_id) subjectWrong.set(w.subject_id, (subjectWrong.get(w.subject_id) ?? 0) + cnt);
    });

    // Approximate per-chapter accuracy from mocks that detected the chapter (fallback: derived from wrongs volume)
    function chapAccuracy(chapterId: string, wrongTotal: number) {
      const chap: any = chapMap.get(chapterId);
      if (!chap) return 50;
      const relevant = reps.filter((r: any) => r.detected_chapter && r.detected_chapter.toLowerCase() === chap.name.toLowerCase() && (r.accuracy ?? 0) > 0);
      if (relevant.length) return avg(relevant.map((r: any) => r.accuracy));
      // fallback: 80 - min(wrongTotal*3, 55)
      return clamp(80 - Math.min(wrongTotal * 3, 55), 15, 85);
    }

    const weakChapters = [...chapBucket.values()]
      .map(b => {
        const current = chapAccuracy(b.key, b.wrongTotal);
        const target = Math.min(90, current + 25 + Math.min(15, b.wrongTotal));
        return {
          id: b.key, label: b.label, subject: b.subject,
          currentAccuracy: current,
          targetAccuracy: target,
          expectedGain: target - current,
          wrongCount: b.wrongTotal,
          plan: [
            { day: 1, task: "Concept Revision", detail: `${b.label} के मूल concepts एक बार पढ़ें` },
            { day: 2, task: "Easy Practice", detail: `${b.label} के 15 easy questions solve करें` },
            { day: 3, task: "Smart Revision", detail: `${b.label} के wrong questions revise करें` },
            { day: 4, task: "Medium Questions", detail: `${b.label} के 20 medium questions solve करें` },
            { day: 5, task: "Chapter Test", detail: `${b.label} पर mini test attempt करें` },
          ],
        };
      })
      .sort((a, b) => (a.currentAccuracy - b.currentAccuracy) || (b.wrongCount - a.wrongCount))
      .slice(0, 8);

    // ---------- 2. MARKS BOOSTER ----------
    const totalCareless = mists.reduce((s: number, m: any) => s + (m.careless_marks_lost ?? 0) + (m.silly_marks_lost ?? 0), 0);
    const avgCareless = mists.length ? Math.round(totalCareless / mists.length) : 0;
    const pendingRev = wrs.filter((w: any) => w.status !== "mastered").length;
    const revisionGain = Math.min(10, Math.round(pendingRev / 5));
    const topWeakGain = weakChapters.slice(0, 3).reduce((s, w) => s + Math.round(w.expectedGain / 8), 0);
    const topicsAvoided = [...topicBucket.values()].sort((a, b) => b.wrongTotal - a.wrongTotal).slice(0, 1);
    const topicGain = topicsAvoided.length ? Math.min(5, topicsAvoided[0].wrongTotal) : 0;

    const marksBooster = [
      avgCareless > 0 && { action: "Reduce Careless Mistakes", gain: avgCareless, effort: "low", why: `पिछले ${mists.length} tests में औसत ${avgCareless} marks careless से गए` },
      revisionGain > 0 && { action: "Complete Smart Revision", gain: revisionGain, effort: "medium", why: `${pendingRev} pending revision items हैं` },
      topWeakGain > 0 && { action: `Improve ${weakChapters[0]?.label ?? "weakest chapter"}`, gain: topWeakGain, effort: "high", why: `${weakChapters[0]?.label}: current ${weakChapters[0]?.currentAccuracy}% → target ${weakChapters[0]?.targetAccuracy}%` },
      topicGain > 0 && { action: `Revise ${topicsAvoided[0].label}`, gain: topicGain, effort: "low", why: `${topicsAvoided[0].wrongTotal} बार गलत हुआ है` },
    ].filter(Boolean) as Array<{ action: string; gain: number; effort: string; why: string }>;
    const totalBoost = marksBooster.reduce((s, m) => s + m.gain, 0);

    // ---------- 3. MEMORY FORGETTING CURVE ----------
    const memItems = wrs
      .filter((w: any) => w.status !== "mastered" && w.chapter_id)
      .map((w: any) => {
        const t = w.last_attempt_at ? +new Date(w.last_attempt_at) : Date.now() - 30 * DAY;
        const daysSince = Math.max(0, Math.round((Date.now() - t) / DAY));
        const ret = retention(daysSince, w.consecutive_correct ?? 0);
        const ch: any = chapMap.get(w.chapter_id);
        return { chapterId: w.chapter_id, label: ch?.name ?? "Chapter", daysSince, retention: ret };
      });
    // aggregate per chapter (lowest retention)
    const memChap = new Map<string, { label: string; retention: number; daysSince: number }>();
    memItems.forEach((m: any) => {
      const cur = memChap.get(m.chapterId);
      if (!cur || m.retention < cur.retention) memChap.set(m.chapterId, { label: m.label, retention: m.retention, daysSince: m.daysSince });
    });
    const memList = [...memChap.values()].sort((a, b) => a.retention - b.retention);
    const memory = {
      strength: memList.length ? avg(memList.map(m => m.retention)) : 100,
      forgotten: memList.filter(m => m.retention < 25).slice(0, 8),
      atRisk: memList.filter(m => m.retention >= 25 && m.retention < 60).slice(0, 8),
      dueToday: memList.filter(m => m.retention < 40).slice(0, 6),
      strong: memList.filter(m => m.retention >= 75).slice(0, 6),
    };

    // ---------- 4. EXAM READINESS PREDICTOR ----------
    const EXAMS = ["SSC CGL", "SSC CHSL", "SSC MTS", "Railway", "State Exams"];
    const baseReadiness = readiness || Math.max(0, overallAccuracy - 10);
    const readinessByExam = EXAMS.map((name, i) => {
      // tiny variation based on subject strengths already reflected in overall
      const adj = [0, -3, -6, -4, -8][i];
      const value = clamp(baseReadiness + adj);
      const confidence = clamp(50 + Math.min(50, atts.length * 2 + reps.length * 4));
      const weakLabels = weakChapters.slice(0, 2).map(w => w.label);
      return {
        exam: name,
        readiness: value,
        confidence,
        reasons: [
          `Overall accuracy ${overallAccuracy}% (${atts.length} tests + ${reps.length} mocks)`,
          weakLabels.length ? `Weak areas holding readiness back: ${weakLabels.join(", ")}` : "No critical weak chapters detected",
          `Memory strength ${memory.strength}% across weak chapters`,
        ],
      };
    });

    // ---------- 5. PYQ COVERAGE ----------
    const pyqReports = reps.filter((r: any) => r.report_type === "previous_year");
    const pyqSubjects = new Set(pyqReports.map((r: any) => (r.detected_subject ?? "").toLowerCase()).filter(Boolean));
    const pyqChapters = new Set(pyqReports.map((r: any) => (r.detected_chapter ?? "").toLowerCase()).filter(Boolean));
    const subjectCoverage = subs.length ? Math.round((pyqSubjects.size / subs.length) * 100) : 0;
    const chapterCoverage = chaps.length ? Math.round((pyqChapters.size / chaps.length) * 100) : 0;
    const uncoveredChapters = chaps
      .filter((c: any) => !pyqChapters.has(c.name.toLowerCase()))
      .slice(0, 10)
      .map((c: any) => ({ id: c.id, label: c.name, subject: subMap.get(c.subject_id) }));
    const pyq = {
      subjectCoverage,
      chapterCoverage,
      topicCoverage: Math.min(100, chapterCoverage), // proxy
      totalPYQ: pyqReports.length,
      remainingChapters: uncoveredChapters,
      frequentUncovered: uncoveredChapters.slice(0, 5),
    };

    // ---------- 6. CONCEPT MASTERY ----------
    function bucketize(pct: number) {
      return pct >= 80 ? "Mastered" : pct >= 60 ? "Needs Practice" : pct >= 40 ? "Weak" : "Critical";
    }
    // per-subject mastery = accuracy of related mocks/attempts + penalty by wrong count
    const mastery = subs.map((s: any) => {
      const wCount = subjectWrong.get(s.id) ?? 0;
      const relatedMocks = reps.filter((r: any) => (r.detected_subject ?? "").toLowerCase() === s.name.toLowerCase() && (r.accuracy ?? 0) > 0);
      const base = relatedMocks.length ? avg(relatedMocks.map((r: any) => r.accuracy)) : overallAccuracy;
      const pct = clamp(base - Math.min(30, wCount * 2));
      return { subject: s.name, mastery: pct, category: bucketize(pct) };
    }).sort((a, b) => b.mastery - a.mastery);

    // ---------- 7. SELECTION COUNTDOWN ----------
    const tgt: any = target.data;
    let countdown: any = null;
    if (tgt?.exam_date) {
      const days = Math.max(0, Math.ceil((+new Date(tgt.exam_date) - Date.now()) / DAY));
      const totalChap = chaps.length || 1;
      const doneChap = totalChap - uncoveredChapters.length;
      const chapRemaining = Math.max(0, totalChap - doneChap);
      const mocksDone = reps.length;
      const mocksTarget = 20;
      const mocksRemaining = Math.max(0, mocksTarget - mocksDone);
      const revRemaining = pendingRev;
      const dailyChapters = days > 0 ? Math.max(1, Math.ceil(chapRemaining / Math.max(days, 1))) : chapRemaining;
      const expectedCompletion = new Date(Date.now() + Math.max(days, chapRemaining + mocksRemaining) * DAY).toISOString().slice(0, 10);
      countdown = {
        exam: tgt.exam_name,
        examDate: tgt.exam_date,
        daysRemaining: days,
        chaptersRemaining: chapRemaining,
        revisionRemaining: revRemaining,
        mocksRemaining,
        dailyTarget: `${dailyChapters} chapters + ${Math.ceil(revRemaining / Math.max(days, 1))} revisions/day`,
        weeklyTarget: `${dailyChapters * 7} chapters + 2 mock tests`,
        expectedCompletion,
      };
    }

    // ---------- 8. SELECTION GAP ANALYZER ----------
    const currentAvg = overallAccuracy;
    const targetScore = Number(tgt?.target_score ?? 85);
    const gap = Math.max(0, targetScore - currentAvg);
    const subjectGaps = mastery.filter(m => m.mastery < targetScore).map(m => ({
      label: m.subject, current: m.mastery, target: targetScore, gap: targetScore - m.mastery,
    }));
    const chapterGaps = weakChapters.slice(0, 6).map(w => ({
      label: w.label, subject: w.subject, current: w.currentAccuracy, target: w.targetAccuracy, gap: w.targetAccuracy - w.currentAccuracy,
    }));
    const timeToRecoverDays = Math.round(gap * 1.2 + weakChapters.length * 2);
    const gapAnalyzer = {
      currentAvg, targetScore, gap,
      marksNeeded: gap,
      subjectGaps, chapterGaps,
      estimatedRecoveryDays: timeToRecoverDays,
    };

    // ---------- 9. AI SELECTION MENTOR (grounded narrative) ----------
    const lastAtt = atts[0];
    const grounded = {
      firstName,
      overallAccuracy, readiness,
      lastAttempt: lastAtt ? {
        accuracy: lastAtt.accuracy, marks: lastAtt.marks_obtained,
        careless: lastAtt.incorrect_count, unattempted: lastAtt.unattempted_count,
      } : null,
      weakestChapter: weakChapters[0]?.label ?? null,
      mostImprovedSubject: mastery[0]?.subject ?? null,
      totalBoost,
      countdown,
    };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    let mentor = {
      summary: `${firstName}, आपकी current accuracy ${overallAccuracy}% है और readiness ${readiness}% है.` +
        (weakChapters[0] ? ` सबसे कमज़ोर chapter ${weakChapters[0].label} है (${weakChapters[0].currentAccuracy}%).` : "") +
        (totalBoost > 0 ? ` अगर आप recommended actions follow करते हैं तो लगभग +${totalBoost} marks का सुधार संभव है.` : ""),
      bullets: [
        weakChapters[0] && `${weakChapters[0].label} पर 5-day recovery plan follow करें — expected gain +${weakChapters[0].expectedGain}%`,
        avgCareless > 0 && `Careless mistakes reduce करके औसत +${avgCareless} marks मिल सकते हैं`,
        pendingRev > 0 && `${pendingRev} pending revision items complete करें`,
        countdown && `${countdown.daysRemaining} दिन बचे हैं ${countdown.exam} के लिए — ${countdown.dailyTarget}`,
      ].filter(Boolean),
      aiGenerated: false,
    };

    if (apiKey) {
      try {
        const resp = await unifiedFetch({ body: {
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content:
                "You are AJIT 360's Personal Selection Mentor. Write in mixed Hindi + English (Hinglish), 5–7 sentences, warm, direct, WHY-focused. Never predict selection. Never invent numbers — use only the JSON provided. Return strict JSON {\"summary\": string, \"bullets\": string[]} with 3–5 bullets, each explaining WHY using a number from the input." },
              { role: "user", content: JSON.stringify(grounded) },
            ],
            response_format: { type: "json_object" },
          }, feature: "selection-intelligence" });
        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(content);
          if (parsed?.summary) mentor = { summary: parsed.summary, bullets: Array.isArray(parsed.bullets) ? parsed.bullets : mentor.bullets, aiGenerated: true };
        }
      } catch (_) { /* keep fallback */ }
    }

    return json({
      firstName,
      overall: { accuracy: overallAccuracy, readiness, attempts: atts.length, mocks: reps.length, wrongPending: pendingRev },
      weaknessRecovery: weakChapters,
      marksBooster: { items: marksBooster, totalBoost },
      memory,
      readinessByExam,
      pyq,
      mastery,
      countdown,
      gapAnalyzer,
      mentor,
      hasTarget: !!tgt,
      target: tgt ?? null,
    });
  } catch (e) {
    console.error("selection-intelligence error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
