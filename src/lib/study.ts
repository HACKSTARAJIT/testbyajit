import { supabase } from "@/integrations/supabase/client";

export type BookmarkType = "pdf" | "chapter" | "test";
export type RevisionType = "chapter" | "test";
export type ActivityType = "subject" | "chapter" | "pdf" | "test";
export type PdfStatus = "not_started" | "reading" | "completed";

/** Record that a user opened something (powers Continue Studying + Recently Opened). Silent for guests. */
export async function recordActivity(
  userId: string | undefined,
  item_type: ActivityType,
  item_id: string,
  subject_id?: string | null,
  title?: string | null,
) {
  if (!userId || !item_id) return;
  await supabase.from("study_activity").upsert(
    { user_id: userId, item_type, item_id, subject_id: subject_id ?? null, title: title ?? null, opened_at: new Date().toISOString() },
    { onConflict: "user_id,item_type,item_id" },
  );
}

export async function fetchActivity(userId: string) {
  const { data } = await supabase
    .from("study_activity")
    .select("*")
    .eq("user_id", userId)
    .order("opened_at", { ascending: false });
  return data ?? [];
}

/** Toggle a bookmark on/off. Returns the new bookmarked state. */
export async function toggleBookmark(
  userId: string, item_type: BookmarkType, item_id: string, subject_id?: string | null, currentlyOn?: boolean,
) {
  if (currentlyOn) {
    await supabase.from("bookmarks").delete().eq("user_id", userId).eq("item_type", item_type).eq("item_id", item_id);
    return false;
  }
  await supabase.from("bookmarks").upsert(
    { user_id: userId, item_type, item_id, subject_id: subject_id ?? null },
    { onConflict: "user_id,item_type,item_id" },
  );
  return true;
}

export async function fetchBookmarks(userId: string) {
  const { data } = await supabase.from("bookmarks").select("*").eq("user_id", userId);
  return data ?? [];
}

/** Toggle a "mark for revision" flag. Returns the new state. */
export async function toggleRevision(
  userId: string, item_type: RevisionType, item_id: string, subject_id?: string | null, currentlyOn?: boolean,
) {
  if (currentlyOn) {
    await supabase.from("revision_items").delete().eq("user_id", userId).eq("item_type", item_type).eq("item_id", item_id);
    return false;
  }
  await supabase.from("revision_items").upsert(
    { user_id: userId, item_type, item_id, subject_id: subject_id ?? null },
    { onConflict: "user_id,item_type,item_id" },
  );
  return true;
}

export async function fetchRevision(userId: string) {
  const { data } = await supabase.from("revision_items").select("*").eq("user_id", userId);
  return data ?? [];
}

export async function saveNote(userId: string, chapter_id: string, content: string, subject_id?: string | null) {
  await supabase.from("notes").upsert(
    { user_id: userId, chapter_id, content, subject_id: subject_id ?? null },
    { onConflict: "user_id,chapter_id" },
  );
}

export async function fetchNotes(userId: string) {
  const { data } = await supabase.from("notes").select("*").eq("user_id", userId);
  return data ?? [];
}

export async function setPdfProgress(
  userId: string, pdf_id: string, status: PdfStatus, last_page?: number, subject_id?: string | null,
) {
  const payload: any = { user_id: userId, pdf_id, status, subject_id: subject_id ?? null };
  if (typeof last_page === "number") payload.last_page = last_page;
  await supabase.from("pdf_progress").upsert(payload, { onConflict: "user_id,pdf_id" });
}

export async function fetchPdfProgress(userId: string) {
  const { data } = await supabase.from("pdf_progress").select("*").eq("user_id", userId);
  return data ?? [];
}
