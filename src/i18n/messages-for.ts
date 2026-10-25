import { hasLocale, defaultLocale } from "./config";
import en from "./messages/en.json";

/** Messages for an explicit locale, for Server Actions (which can't read the route's locale). */
export function messagesFor(locale: string): typeof en {
  const dictionaries = { en } as const;
  return dictionaries[hasLocale(locale) ? locale : defaultLocale];
}
