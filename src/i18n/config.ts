/**
 * Supported locales. English only until the core experience is validated
 * (directive §14). Adding a language = add a messages file and a code here.
 */
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

const rtlLocales: readonly string[] = ["ar", "he", "fa", "ur"];

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function textDirection(locale: string): "ltr" | "rtl" {
  return rtlLocales.includes(locale.split("-")[0]) ? "rtl" : "ltr";
}
