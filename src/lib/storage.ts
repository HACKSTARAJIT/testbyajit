import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "study-materials";

export async function uploadFile(file: File, folder = "pdfs"): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

export async function getSignedUrl(path: string, bucket: string = BUCKET): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
