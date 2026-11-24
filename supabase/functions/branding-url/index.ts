import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { canReadBranding } from "./access.ts";

const expiresIn = 300;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => null);
    const path = body?.path;
    if (typeof path !== "string" || !path || path.length > 1024 ||
      path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..")) {
      return json({ error: "Invalid file request" }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Media unavailable" }, 503);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    let userId: string | null = null;
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const auth = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data, error } = await auth.auth.getUser(token);
      if (!error && data.user) userId = data.user.id;
    }
    // Invalid/anonymous credentials never grant private media access.
    const [intro, feedback, roles] = await Promise.all([
      admin.from("app_intro").select("id").eq("enabled", true).eq("file_path", path).limit(1),
      userId ? admin.from("feedback_media").select("id").eq("enabled", true).eq("file_path", path).limit(1)
        : Promise.resolve({ data: [], error: null }),
      userId ? admin.from("user_roles").select("role").eq("user_id", userId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (intro.error || feedback.error || roles.error) return json({ error: "Media unavailable" }, 503);
    if (!canReadBranding({ userId, roles: (roles.data ?? []).map((row) => row.role),
      enabledIntro: Boolean(intro.data?.length), enabledFeedback: Boolean(feedback.data?.length) })) {
      return json({ error: "Media unavailable" }, 403);
    }
    const { data, error } = await admin.storage.from("branding").createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) return json({ error: "Media unavailable" }, 404);
    return json({ signedUrl: data.signedUrl, expiresIn });
  } catch {
    return json({ error: "Media unavailable" }, 500);
  }
});