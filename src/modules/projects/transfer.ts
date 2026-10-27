import { createHash, randomBytes } from "node:crypto";

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
