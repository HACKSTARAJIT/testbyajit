import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { unifiedFetch } from "../_shared/unifiedAI.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Detail = {
  question_text?: string;
  chapter?: string | null;
  topic?: string | null;
  correct_answer?: string | null;
  selected?: string | null;
  status?: string;
};

function summarise(details: Detail[]) {
  const byTopic = new Map<string, { wrong: number; total: number }>();
  const byChapter = new Map<string, { wrong: number; total: number }>();
  for (const d of details) {
    const t = (d.topic ?? "").trim() || "Unclassified";
    const c = (d.chapter ?? "").trim() || "Unclassified";
    const bad = d.status !== "correct";
    const tt = byTopic.get(t) ?? { wrong: 0, total: 0 };
    tt.total++; if (bad) tt.wrong++;
    byTopic.set(t, tt);
    const cc = byChapter.get(c) ?? { wrong: 0, total: 0 };
    cc.total++; if (bad) cc.wrong++;
    byChapter.set(c, cc);
  }
  const fmt = (m: Map<string, { wrong: number; total: number }>) =>
    [...m.entries()]
      .sort((a, b) => b[1].wrong - a[1].wrong)
      .slice(0, 12)
      .map(([k, v]) => `${k}: ${v.wrong} गलत / ${v.total}`)
      .join("; ");
  return { topics: fmt(byTopic), chapters: fmt(byChapter) };
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

    const { attemptId, mode = "analyze" } = await req.json().catch(() => ({}));
    if (!attemptId) return json({ error: "attemptId आवश्यक है" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: attempt } = await admin
      .from("revision_practice_attempts")
      .select("*")
      .eq("id", attemptId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!attempt) return json({ error: "Attempt नहीं मिला" }, 404);

    const [{ data: sameTest }, { data: history }] = await Promise.all([
      admin
        .from("revision_practice_attempts")
        .select("id, title, correct_count, total_questions, accuracy, created_at, details")
        .eq("user_id", userId)
        .eq("source", (attempt as any).source)
        .eq("source_key", (attempt as any).source_key)
        .order("created_at", { ascending: true }),
      admin
        .from("revision_practice_attempts")
        .select("title, subject, chapter, correct_count, total_questions, accuracy, created_at, details")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const cur = attempt as any;
    const curSum = summarise((cur.details ?? []) as Detail[]);
    const curWrong = ((cur.details ?? []) as Detail[])
      .filter((d) => d.status !== "correct")
      .slice(0, 25)
      .map((d) => `- ${(d.question_text ?? "").slice(0, 160)} [Chapter: ${d.chapter ?? "-"} | Topic: ${d.topic ?? "-"} | सही: ${d.correct_answer ?? "-"} | तुम्हारा: ${d.selected ?? "छोड़ा"}]`)
      .join("\n") || "कोई गलत question नहीं।";

    const prevList = (sameTest ?? []).filter((r: any) => r.id !== cur.id);
    const prev = prevList[prevList.length - 1] as any | undefined;

    const historyLines = (history ?? [])
      .map((h: any) =>
        `${new Date(h.created_at).toLocaleDateString("en-IN")} · ${h.title} (${h.subject ?? "-"}/${h.chapter ?? "-"}) → ${h.correct_count}/${h.total_questions}, ${h.accuracy}%`,
      )
      .join("\n") || "कोई पुरानी history नहीं।";

    const historyTopics = summarise(
      (history ?? []).flatMap((h: any) => (h.details ?? []) as Detail[]),
    );

    const common = `
छात्र का ताज़ा Practice Test:
शीर्षक: ${cur.title} | Subject: ${cur.subject ?? "-"} | Chapter: ${cur.chapter ?? "-"}
Score: ${cur.correct_count}/${cur.total_questions} · Accuracy: ${cur.accuracy}% · Wrong: ${cur.wrong_count} · Skipped: ${cur.skipped_count} · समय: ${cur.time_taken_seconds}s
इस test के Topic-wise आँकड़े: ${curSum.topics}
इस test के Chapter-wise आँकड़े: ${curSum.chapters}

इस test की गलत/छूटी questions:
${curWrong}

पूरी revision history (नवीनतम पहले):
${historyLines}

पूरी history के Topic-wise आँकड़े: ${historyTopics.topics}
पूरी history के Chapter-wise आँकड़े: ${historyTopics.chapters}
`.trim();

    const analyzePrompt = `${common}

ऊपर दिए गए असली आँकड़ों के आधार पर ही जवाब दो। कोई भी अनुमान या generic सलाह मत दो। अगर किसी सवाल का data नहीं है तो साफ़ लिखो "पर्याप्त data नहीं"।
पूरा जवाब सिर्फ़ हिंदी में, छोटे-छोटे bullet points में, इन heading के साथ दो:

1) 📉 सबसे कमजोर Subject
2) 📕 सबसे कमजोर Chapter
3) 🔁 बार-बार गलत होने वाला Topic
4) ⚠️ बार-बार दोहराई जा रही गलती
5) 💰 किस Topic से सबसे ज़्यादा Marks मिल सकते हैं
6) 📖 अगला Revision किस Chapter का करें
7) 🎯 अगला Test किस Topic का दें
8) ⏰ अगले 24 घंटे में क्या पढ़ें
9) 🚀 Score बढ़ाने की Priority (1-2-3)`;

    const comparePrompt = prev
      ? `${common}

पिछला attempt: ${prev.correct_count}/${prev.total_questions}, Accuracy ${prev.accuracy}% (${new Date(prev.created_at).toLocaleDateString("en-IN")})
पिछले attempt की गलत questions के topics: ${summarise((prev.details ?? []) as Detail[]).topics}

सिर्फ़ हिंदी में, इन headings के साथ तुलना करो (सिर्फ़ ऊपर दिए data से):
1) 📊 पिछला Score बनाम आज का Score
2) 🎯 पिछली Accuracy बनाम आज की Accuracy
3) ✅ जो Topics सुधरे
4) ❌ जो Topics अब भी कमजोर हैं
5) 🆕 नई गलतियाँ
6) 🔁 दोहराई गई गलतियाँ
7) 📖 अगला Revision क्या करें`
      : `${common}

इस test का यह पहला attempt है — कोई पिछला attempt उपलब्ध नहीं है। सिर्फ़ हिंदी में 4-6 bullet में बताओ कि आज का प्रदर्शन कैसा रहा और दोबारा attempt करने से पहले किन topics को revise करना है। सिर्फ़ ऊपर दिए गए data का इस्तेमाल करो।`;

    const res = await unifiedFetch({
      feature: "revision-practice-ai",
      body: {
        messages: [
          {
            role: "system",
            content:
              "तुम AJIT AI हो — एक सख़्त, व्यावहारिक exam mentor। हमेशा सिर्फ़ हिंदी में जवाब दो। सिर्फ़ दिए गए छात्र-data का उपयोग करो, कोई कल्पना या generic सलाह नहीं।",
          },
          { role: "user", content: mode === "compare" ? comparePrompt : analyzePrompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      },
      dedupKey: `${attemptId}:${mode}`,
    });

    if (!res.ok) {
      const err = await res.json();
      return json({ error: err?.error ?? "AI उपलब्ध नहीं है" }, 503);
    }
    const data = await res.json();
    const text: string =
      data?.choices?.[0]?.message?.content ?? data?.text ?? data?.content ?? "";
    if (!text.trim()) return json({ error: "AI ने खाली जवाब दिया" }, 502);

    await admin
      .from("revision_practice_attempts")
      .update(mode === "compare" ? { ai_comparison: text } : { ai_analysis: text })
      .eq("id", attemptId);

    return json({ text });
  } catch (e) {
    console.error("revision-practice-ai error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
