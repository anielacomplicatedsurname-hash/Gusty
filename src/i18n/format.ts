/** Fills `{name}` placeholders in a message. */
export function fill(message: string, values: Record<string, string>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** Gusty's English is British, so "en" dates read day first. */
const dateLocale = (locale: string) => (locale === "en" ? "en-GB" : locale);

/** A calendar date (YYYY-MM-DD) in words, e.g. "12 December 2026". Read as UTC so it never shifts a day. */
export function formatDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}
