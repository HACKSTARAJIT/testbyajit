import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HomeData {
  loading: boolean;
  displayName: string;
  streak: number;
  accuracy: number;
  readiness: number;
  prepScore: number;
  testsCompleted: number;
  questionsSolved: number;
  studyMinutes: number;
  pdfsCompleted: number;
  pendingRevision: number;
  wrongTotal: number;
  weeklyBuckets: { day: string; date: string; minutes: number; questions: number; accuracy: number; tests: number; revised: number }[];
  attempts: any[];
  reports: any[];
  wrongs: any[];
  activity: any[];
  tasks: any[];
  goals: { target_accuracy: number | null; target_readiness: number | null; target_score: number | null } | null;
  achievements: Set<string>;
  subjects: any[];
}

const empty: HomeData = {
  loading: true,
  displayName: "",
  streak: 0,
  accuracy: 0,
  readiness: 0,
  prepScore: 0,
  testsCompleted: 0,
  questionsSolved: 0,
  studyMinutes: 0,
  pdfsCompleted: 0,
  pendingRevision: 0,
  wrongTotal: 0,
  weeklyBuckets: [],
  attempts: [],
  reports: [],
  wrongs: [],
  activity: [],
  tasks: [],
  goals: null,
  achievements: new Set(),
  subjects: [],
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useHomeData(userId?: string) {
  const [data, setData] = useState<HomeData>(empty);

  useEffect(() => {
    if (!userId) { setData({ ...empty, loading: false }); return; }
    let alive = true;
    (async () => {
      const [profile, attemptsR, reportsR, wrongsR, actR, pdfR, goalsR, achR, tasksR, subsR] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
        supabase.from("test_attempts").select("id,accuracy,marks_obtained,total_questions,correct_count,time_taken,created_at,test_id,status")
          .eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
        supabase.from("ai_mock_reports").select("id,accuracy,readiness_score,status,report_type,created_at").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(30),
        supabase.from("wrong_questions").select("id,status,priority,subject_id,created_at,last_attempt_at,mastered_at").eq("user_id", userId),
        supabase.from("study_activity").select("id,item_type,item_id,subject_id,title,opened_at").eq("user_id", userId).order("opened_at", { ascending: false }).limit(50),
        supabase.from("pdf_progress").select("pdf_id,status,updated_at").eq("user_id", userId),
        supabase.from("user_goals").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_achievements").select("code").eq("user_id", userId),
        (supabase as any).from("study_plan_tasks").select("id,status,task_date,estimated_minutes,title,subject").eq("user_id", userId).order("task_date", { ascending: false }).limit(60),
        supabase.from("subjects").select("id,name"),
      ]);
      if (!alive) return;

      const attempts = attemptsR.data ?? [];
      const reports = reportsR.data ?? [];
      const wrongs = wrongsR.data ?? [];
      const activity = actR.data ?? [];
      const pdfs = pdfR.data ?? [];
      const tasks = (tasksR.data as any[]) ?? [];

      const attemptAcc = attempts.map((a: any) => a.accuracy ?? 0).filter((x: number) => x > 0);
      const mockAcc = reports.map((r: any) => r.accuracy ?? 0).filter((x: number) => x > 0);
      const readys = reports.map((r: any) => r.readiness_score ?? 0).filter((x: number) => x > 0);
      const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;
      const accuracy = avg([...attemptAcc, ...mockAcc]);
      const readiness = avg(readys);

      // Prep score: blend accuracy(40) + readiness(30) + coverage(15) + revision(15)
      const pdfsCompleted = pdfs.filter((p: any) => p.status === "completed").length;
      const pdfsTotal = pdfs.length || 1;
      const coverage = Math.round((pdfsCompleted / pdfsTotal) * 100);
      const pending = wrongs.filter((w: any) => w.status === "pending").length;
      const mastered = wrongs.filter((w: any) => w.status === "mastered").length;
      const revisionScore = wrongs.length ? Math.round((mastered / wrongs.length) * 100) : 100;
      const prepScore = Math.round(accuracy * 0.4 + readiness * 0.3 + coverage * 0.15 + revisionScore * 0.15);

      // Streak: distinct days with any activity in last 60 days (attempts + activity)
      const days = new Set<string>();
      attempts.forEach((a: any) => a.created_at && days.add(dayKey(new Date(a.created_at))));
      activity.forEach((a: any) => a.opened_at && days.add(dayKey(new Date(a.opened_at))));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        if (days.has(dayKey(d))) streak++;
        else if (i > 0) break; // allow today missing
      }

      // Weekly buckets last 7 days
      const buckets: HomeData["weeklyBuckets"] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        const key = dayKey(d);
        const dayAttempts = attempts.filter((a: any) => a.created_at?.slice(0, 10) === key);
        const dayActs = activity.filter((a: any) => a.opened_at?.slice(0, 10) === key);
        const dayWrongs = wrongs.filter((w: any) => w.mastered_at?.slice(0, 10) === key);
        const minutes = dayAttempts.reduce((s: number, a: any) => s + Math.round((a.time_taken ?? 0) / 60), 0)
          + dayActs.length * 5;
        const questions = dayAttempts.reduce((s: number, a: any) => s + (a.total_questions ?? 0), 0);
        const accs = dayAttempts.map((a: any) => a.accuracy ?? 0).filter((x: number) => x > 0);
        buckets.push({
          day: DOW[d.getDay()],
          date: key,
          minutes,
          questions,
          accuracy: accs.length ? Math.round(accs.reduce((s, x) => s + x, 0) / accs.length) : 0,
          tests: dayAttempts.length,
          revised: dayWrongs.length,
        });
      }

      const questionsSolved = attempts.reduce((s: number, a: any) => s + (a.total_questions ?? 0), 0);
      const studyMinutes = attempts.reduce((s: number, a: any) => s + Math.round((a.time_taken ?? 0) / 60), 0)
        + tasks.filter((t: any) => t.status === "completed").reduce((s: number, t: any) => s + (t.estimated_minutes ?? 0), 0);

      setData({
        loading: false,
        displayName: (profile.data as any)?.display_name ?? "",
        streak,
        accuracy,
        readiness,
        prepScore,
        testsCompleted: attempts.length,
        questionsSolved,
        studyMinutes,
        pdfsCompleted,
        pendingRevision: pending,
        wrongTotal: wrongs.length,
        weeklyBuckets: buckets,
        attempts,
        reports,
        wrongs,
        activity,
        tasks,
        goals: (goalsR.data as any) ?? null,
        achievements: new Set(((achR.data as any[]) ?? []).map((r: any) => r.code)),
        subjects: (subsR.data as any[]) ?? [],
      });
    })();
    return () => { alive = false; };
  }, [userId]);

  return data;
}
