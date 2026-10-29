/** Deep searches cost real money (web searches and pages read), so each one is rationed. Results are kept. */
export const SEARCHES_PER_PROJECT_PER_DAY = 1;
export const SEARCHES_PER_PERSON_PER_DAY = 3;
/** A search still "running" after this long was interrupted (e.g. a restart) and counts as failed. */
export const SEARCH_STALE_MS = 10 * 60 * 1000;
