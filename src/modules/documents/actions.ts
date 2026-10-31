"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

/** Forgets what Gusty learned from a document. Suggestions it added to the reading stay until changed there. */
export async function deleteDocument(documentId: string): Promise<{ ok: boolean }> {
  if (!isProjectId(documentId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("project_documents").delete().eq("id", documentId);
  return { ok: !error };
}
