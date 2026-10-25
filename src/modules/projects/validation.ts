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
  // Browsers drop tabs and line breaks inside URLs, so "/\t/evil.example" would become "//evil.example".
  const clean = raw && !/[\u0000-\u001f\u007f\\]/.test(raw);
  return clean && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

/**
 * Where to send someone after an email link. Always built on the public site address:
 * behind a host like Render the request's own URL is an internal one (e.g. localhost:10000).
 */
export function signInDestination(rawNext: string | null, ok: boolean, siteUrl: string, fallback: string) {
  let url = new URL(safeNextPath(rawNext, fallback), siteUrl);
  // Belt and braces: whatever the path, the destination must be Gusty itself.
  if (url.origin !== new URL(siteUrl).origin) url = new URL(fallback, siteUrl);
  if (!ok) url.searchParams.set("signin", "failed");
  return url.toString();
}
