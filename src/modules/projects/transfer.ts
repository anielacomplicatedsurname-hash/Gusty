import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Bringing a guest's projects into an existing account. The secret lives only in this browser's
 * cookie; the database keeps its SHA-256, so the transfer can only be finished on the same device.
 */
export const TRANSFER_COOKIE = "gusty_transfer";
export const TRANSFER_MAX_AGE_SECONDS = 60 * 60;

export function newTransferSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTransferSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * After signing in on this device (email link or code): if this browser started "Sign in and keep my
 * projects", move the guest's projects into the account. Safe to call when there's nothing to move.
 */
export async function finishProjectTransfer(supabase: SupabaseClient<Database>) {
  const cookieStore = await cookies();
  const secret = cookieStore.get(TRANSFER_COOKIE)?.value;
  if (!secret) return;
  const { error } = await supabase.rpc("claim_guest_projects", { p_token_hash: hashTransferSecret(secret) });
  if (error) console.error("Bringing guest projects failed:", error.message);
  cookieStore.delete({ name: TRANSFER_COOKIE, path: "/" });
}
