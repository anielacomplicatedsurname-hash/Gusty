export const IDEA_MAX_LENGTH = 5000;
const TITLE_MAX_LENGTH = 60;

export type IdeaCheck = { ok: true; idea: string } | { ok: false; error: "empty" | "tooLong" };

export function checkIdea(raw: unknown): IdeaCheck {
  const idea = typeof raw === "string" ? raw.trim() : "";
  if (!idea) return { ok: false, error: "empty" };
  if (idea.length > IDEA_MAX_LENGTH) return { ok: false, error: "tooLong" };
  return { ok: true, idea };
}

/** A working title from the person's own words: the first line, cut at a word boundary. */
export function titleFromIdea(idea: string): string {
  const firstLine = idea.trim().split(/\r?\n/, 1)[0].replace(/\s+/g, " ");
  if (firstLine.length <= TITLE_MAX_LENGTH) return firstLine;
  const cut = firstLine.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProjectId = (value: string) => UUID.test(value);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function checkEmail(raw: unknown): string | null {
  const email = typeof raw === "string" ? raw.trim() : "";
  return email.length <= 320 && EMAIL.test(email) ? email : null;
}

/** Only same-site paths may be used as a post-sign-in destination. */
export function safeNextPath(raw: string | null, fallback: string): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : fallback;
}
