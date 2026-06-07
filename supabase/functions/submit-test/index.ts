import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { test_id, answers, time_taken_seconds } = await req.json();
    if (!test_id || typeof answers !== "object") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client reads the answer key securely
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: questions, error: qErr } = await admin
      .from("questions")
      .select("*")
      .eq("test_id", test_id)
      .order("sort_order");

    if (qErr || !questions) {
      return new Response(JSON.stringify({ error: "Could not load test" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let score = 0;
    let correct = 0;
    let totalMarks = 0;
    const review = questions.map((qn: any) => {
      totalMarks += qn.marks;
      const isCorrect = answers[qn.id] === qn.correct_option;
      if (isCorrect) {
        score += qn.marks;
        correct += 1;
      }
      return { id: qn.id, correct_option: qn.correct_option };
    });

    const { error: insErr } = await admin.from("results").insert({
      user_id: userId,
      test_id,
      score,
      total_marks: totalMarks,
      correct_count: correct,
      total_questions: questions.length,
      answers,
      time_taken_seconds: time_taken_seconds ?? 0,
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: "Could not save result" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        score,
        totalMarks,
        correct,
        total: questions.length,
        review,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
