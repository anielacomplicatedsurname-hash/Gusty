const MAX = 2000;

/** Tidies one answer: trimmed, capped, empty becomes null. */
export function cleanAnswer(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim().slice(0, MAX);
  return text || null;
}

/** Where the feedback came from, without anything identifying: ids become ":id". */
export function cleanPage(value: FormDataEntryValue | null): string | null {
  const path = String(value ?? "");
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path
    .split(/[?#]/)[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .slice(0, 200);
}
