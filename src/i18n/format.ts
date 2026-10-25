/** Fills `{name}` placeholders in a message. */
export function fill(message: string, values: Record<string, string>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
