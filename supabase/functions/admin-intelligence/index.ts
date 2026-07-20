import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { unifiedFetch } from "../_shared/unifiedAI.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, service);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      case "overview": return json(await getOverview(admin));
      case "live_activity": return json(await getLiveActivity(admin));
      case "students_list": return json(await getStudentsList(admin));
      case "student_detail": return json(await getStudentDetail(admin, body.user_id));
      case "leaderboard": return json(await getLeaderboard(admin));
      case "insights": return json(await getInsights(admin));
      default: return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function emailMap(admin: any, ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const map: Record<string, string> = {};
  // Fetch via admin API in batches
  const uniq = Array.from(new Set(ids));
  const chunkSize = 200;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const { data } = await admin.rpc("admin_get_user_emails", { _user_ids: chunk });
    (data ?? []).forEach((r: any) => { map[r.user_id] = r.email; });
  }
  return map;
}

async function getOverview(admin: any) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const [profiles, roles, activityToday, activityWeek, online, newReg] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("user_roles").select("user_id, role"),
    admin.from("study_activity").select("user_id").gte("opened_at", today),
    admin.from("study_activity").select("user_id").gte("opened_at", week),
    admin.from("study_activity").select("user_id").gte("opened_at", fiveMinAgo),
    admin.from("profiles").select("id").gte("created_at", week),
  ]);

  const adminIds = new Set((roles.data ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
  const uniq = (arr: any[]) => new Set((arr ?? []).map((r: any) => r.user_id)).size;

  return {
    total_students: (profiles.count ?? 0) - adminIds.size,
    online_now: uniq(online.data),
    active_today: uniq(activityToday.data),
    active_week: uniq(activityWeek.data),
    new_registrations: newReg.data?.length ?? 0,
    premium_users: 0,
    guest_users: 0,
  };
}

async function getLiveActivity(admin: any) {
  const [act, attempts] = await Promise.all([
    admin.from("study_activity")
      .select("user_id, item_type, title, subject_id, opened_at, subjects(name)")
      .order("opened_at", { ascending: false }).limit(50),
    admin.from("test_attempts")
      .select("user_id, marks_obtained, accuracy, updated_at, status, tests(title, subjects(name), chapters(name))")
      .order("updated_at", { ascending: false }).limit(50),
  ]);

  const ids = [...(act.data ?? []).map((a: any) => a.user_id), ...(attempts.data ?? []).map((a: any) => a.user_id)];
  const [emails, profs] = await Promise.all([
    emailMap(admin, ids),
    admin.from("profiles").select("id, display_name").in("id", Array.from(new Set(ids))),
  ]);
  const nameMap: Record<string, string> = {};
  (profs.data ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name; });

  const activity = (act.data ?? []).map((a: any) => ({
    user_id: a.user_id,
    name: nameMap[a.user_id] ?? emails[a.user_id]?.split("@")[0] ?? "—",
    email: emails[a.user_id] ?? "—",
    item_type: a.item_type,
    title: a.title,
    subject: a.subjects?.name,
    opened_at: a.opened_at,
  }));

  const tests = (attempts.data ?? []).map((a: any) => ({
    user_id: a.user_id,
    name: nameMap[a.user_id] ?? emails[a.user_id]?.split("@")[0] ?? "—",
    email: emails[a.user_id] ?? "—",
    test: a.tests?.title,
    subject: a.tests?.subjects?.name,
    chapter: a.tests?.chapters?.name,
    score: a.marks_obtained,
    accuracy: a.accuracy,
    status: a.status,
    at: a.updated_at,
  }));

  return { activity, tests };
}

async function getStudentsList(admin: any) {
  const [profs, roles, attempts, wrong, revItems, activity] = await Promise.all([
    admin.from("profiles").select("id, display_name, created_at"),
    admin.from("user_roles").select("user_id, role"),
    admin.from("test_attempts").select("user_id, accuracy, correct_count, incorrect_count, marks_obtained, updated_at, status"),
    admin.from("wrong_questions").select("user_id, id"),
    admin.from("revision_items").select("user_id, status"),
    admin.from("study_activity").select("user_id, opened_at"),
  ]);

  const adminIds = new Set((roles.data ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
  const students = (profs.data ?? []).filter((p: any) => !adminIds.has(p.id));
  const ids = students.map((p: any) => p.id);
  const emails = await emailMap(admin, ids);

  const perUser: Record<string, any> = {};
  for (const p of students) {
    perUser[p.id] = {
      user_id: p.id,
      name: p.display_name ?? emails[p.id]?.split("@")[0] ?? "—",
      email: emails[p.id] ?? "—",
      phone: null,
      created_at: p.created_at,
      last_login: null,
      accuracy: 0,
      score: 0,
      questions_solved: 0,
      wrong_count: 0,
      revision_pending: 0,
      revision_done: 0,
      streak: 0,
      readiness: 0,
    };
  }

  // Aggregate attempts
  const attemptsByUser: Record<string, any[]> = {};
  (attempts.data ?? []).forEach((a: any) => {
    if (!perUser[a.user_id]) return;
    (attemptsByUser[a.user_id] ||= []).push(a);
  });
  for (const uid of Object.keys(attemptsByUser)) {
    const arr = attemptsByUser[uid];
    const totalAnswered = arr.reduce((s, x) => s + (x.correct_count || 0) + (x.incorrect_count || 0), 0);
    const totalCorrect = arr.reduce((s, x) => s + (x.correct_count || 0), 0);
    perUser[uid].questions_solved = totalAnswered;
    perUser[uid].accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    perUser[uid].score = Math.round(arr.reduce((s, x) => s + Number(x.marks_obtained || 0), 0));
    perUser[uid].readiness = Math.min(100, Math.round(perUser[uid].accuracy * 0.7 + Math.min(arr.length * 3, 30)));
    const last = arr.map(x => new Date(x.updated_at).getTime()).sort((a, b) => b - a)[0];
    if (last) perUser[uid].last_login = new Date(last).toISOString();
  }

  (wrong.data ?? []).forEach((w: any) => {
    if (perUser[w.user_id]) perUser[w.user_id].wrong_count += 1;
  });
  (revItems.data ?? []).forEach((r: any) => {
    if (!perUser[r.user_id]) return;
    if (r.status === "done" || r.status === "completed") perUser[r.user_id].revision_done += 1;
    else perUser[r.user_id].revision_pending += 1;
  });

  // Streak — distinct days in last 30
  const byUserDays: Record<string, Set<string>> = {};
  (activity.data ?? []).forEach((a: any) => {
    if (!perUser[a.user_id]) return;
    const d = new Date(a.opened_at).toISOString().slice(0, 10);
    (byUserDays[a.user_id] ||= new Set()).add(d);
  });
  for (const uid of Object.keys(byUserDays)) {
    // consecutive days back from today
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (byUserDays[uid].has(d)) streak++;
      else if (i === 0) continue;
      else break;
    }
    perUser[uid].streak = streak;
  }

  return { students: Object.values(perUser) };
}

async function getStudentDetail(admin: any, userId: string) {
  if (!userId) throw new Error("user_id required");
  const [prof, attempts, wrong, revItems, revTests, reports, snapshots, plan, threads, msgs, activity, perf] = await Promise.all([
    admin.from("profiles").select("id, display_name, created_at").eq("id", userId).maybeSingle(),
    admin.from("test_attempts").select("*, tests(title, subjects(name), chapters(name))").eq("user_id", userId).order("updated_at", { ascending: false }),
    admin.from("wrong_questions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    admin.from("revision_items").select("*").eq("user_id", userId),
    admin.from("revision_tests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("ai_mock_reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("ai_coach_snapshots").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    admin.from("study_plan_tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("ai_chat_threads").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    admin.from("ai_chat_messages").select("thread_id, role, content, created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("study_activity").select("*, subjects(name)").eq("user_id", userId).order("opened_at", { ascending: false }).limit(100),
    admin.from("performance").select("*, subjects(name)").eq("user_id", userId),
  ]);

  const emails = await emailMap(admin, [userId]);

  // Subject/chapter accuracy from attempts
  const bySubj: Record<string, { c: number; i: number; name: string }> = {};
  const byChap: Record<string, { c: number; i: number; name: string; subj: string }> = {};
  (attempts.data ?? []).forEach((a: any) => {
    const sn = a.tests?.subjects?.name ?? "—";
    const cn = a.tests?.chapters?.name ?? "General";
    bySubj[sn] ||= { c: 0, i: 0, name: sn };
    bySubj[sn].c += a.correct_count || 0;
    bySubj[sn].i += a.incorrect_count || 0;
    const key = `${sn}::${cn}`;
    byChap[key] ||= { c: 0, i: 0, name: cn, subj: sn };
    byChap[key].c += a.correct_count || 0;
    byChap[key].i += a.incorrect_count || 0;
  });
  const subjectAcc = Object.values(bySubj).map(s => ({
    name: s.name, accuracy: s.c + s.i ? Math.round((s.c / (s.c + s.i)) * 100) : 0, total: s.c + s.i,
  })).sort((a, b) => b.accuracy - a.accuracy);
  const chapterAcc = Object.values(byChap).map(s => ({
    name: s.name, subject: s.subj, accuracy: s.c + s.i ? Math.round((s.c / (s.c + s.i)) * 100) : 0, total: s.c + s.i,
  })).sort((a, b) => a.accuracy - b.accuracy);

  const trend = (attempts.data ?? [])
    .slice(0, 20).reverse()
    .map((a: any) => ({ date: a.updated_at, accuracy: Number(a.accuracy), score: Number(a.marks_obtained), test: a.tests?.title }));

  const totalAns = (attempts.data ?? []).reduce((s: number, x: any) => s + (x.correct_count || 0) + (x.incorrect_count || 0), 0);
  const totalCorrect = (attempts.data ?? []).reduce((s: number, x: any) => s + (x.correct_count || 0), 0);
  const overall_accuracy = totalAns ? Math.round((totalCorrect / totalAns) * 100) : 0;
  const readiness = reports.data?.[0]?.readiness_score ?? Math.min(100, Math.round(overall_accuracy * 0.7 + Math.min((attempts.data ?? []).length * 2, 30)));

  return {
    profile: {
      user_id: userId,
      name: prof.data?.display_name ?? "—",
      email: emails[userId] ?? "—",
      created_at: prof.data?.created_at,
    },
    overall: {
      accuracy: overall_accuracy,
      readiness,
      score: (attempts.data ?? []).reduce((s: number, x: any) => s + Number(x.marks_obtained || 0), 0),
      tests_taken: (attempts.data ?? []).length,
    },
    subject_accuracy: subjectAcc,
    chapter_accuracy: chapterAcc,
    weak_subjects: subjectAcc.filter(s => s.accuracy < 60).slice(0, 5),
    strong_subjects: subjectAcc.filter(s => s.accuracy >= 75).slice(0, 5),
    weak_chapters: chapterAcc.filter(c => c.accuracy < 60).slice(0, 10),
    trend,
    test_history: (attempts.data ?? []).slice(0, 100).map((a: any) => ({
      id: a.id,
      test: a.tests?.title,
      subject: a.tests?.subjects?.name,
      chapter: a.tests?.chapters?.name,
      date: a.updated_at,
      score: a.marks_obtained,
      accuracy: a.accuracy,
      time: a.time_taken_seconds,
      correct: a.correct_count,
      wrong: a.incorrect_count,
      skipped: a.skipped_count,
    })),
    mock_reports: reports.data ?? [],
    coach_snapshots: snapshots.data ?? [],
    wrong_questions: wrong.data ?? [],
    revision_items: revItems.data ?? [],
    revision_tests: revTests.data ?? [],
    study_plan: plan.data ?? [],
    coach_threads: threads.data ?? [],
    activity: activity.data ?? [],
    performance: perf.data ?? [],
  };
}

async function getLeaderboard(admin: any) {
  const list = await getStudentsList(admin);
  const s = (list as any).students as any[];
  return {
    top_accuracy: [...s].filter(x => x.questions_solved > 5).sort((a, b) => b.accuracy - a.accuracy).slice(0, 10),
    top_score: [...s].sort((a, b) => b.score - a.score).slice(0, 10),
    most_active: [...s].sort((a, b) => b.questions_solved - a.questions_solved).slice(0, 10),
    longest_streak: [...s].sort((a, b) => b.streak - a.streak).slice(0, 10),
    highest_revision: [...s].sort((a, b) => b.revision_done - a.revision_done).slice(0, 10),
  };
}

async function getInsights(admin: any) {
  const [overview, list] = await Promise.all([getOverview(admin), getStudentsList(admin)]);
  const key = Deno.env.get("LOVABLE_API_KEY");
  const s = (list as any).students as any[];
  const avgAcc = s.length ? Math.round(s.reduce((x, y) => x + y.accuracy, 0) / s.length) : 0;
  const stats = {
    ...overview,
    avg_accuracy: avgAcc,
    total_wrong: s.reduce((x, y) => x + y.wrong_count, 0),
    revision_backlog: s.reduce((x, y) => x + y.revision_pending, 0),
    active_students: s.filter(x => x.questions_solved > 0).length,
  };
  if (!key) return { insights: [
    `Total students: ${stats.total_students}. Active this week: ${stats.active_week}.`,
    `Average accuracy across students: ${stats.avg_accuracy}%.`,
    `Pending smart revision items across all students: ${stats.revision_backlog}.`,
  ], stats };

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an academic analytics assistant. Given aggregate student stats, produce 5-6 short, specific, data-backed insight one-liners for the admin. Return JSON array of strings only." },
          { role: "user", content: `Stats: ${JSON.stringify(stats)}` },
        ],
      }),
    });
    const data = await res.json();
    const txt = data.choices?.[0]?.message?.content ?? "[]";
    const match = txt.match(/\[[\s\S]*\]/);
    const arr = match ? JSON.parse(match[0]) : [];
    return { insights: arr, stats };
  } catch (e) {
    return { insights: [`Stats: ${JSON.stringify(stats)}`], stats };
  }
}
