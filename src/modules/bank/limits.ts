/** Research searches read real web pages, so each one costs money: a small allowance of its own. */
export const RESEARCH_PER_PROJECT_PER_DAY = 1;
export const RESEARCH_PER_PERSON_PER_DAY = 2;
/** A research search that hasn't finished after this long is treated as failed. */
export const RESEARCH_STALE_MS = 10 * 60 * 1000;
export const EVIDENCE_KINDS = ["past_project", "win", "quote", "number", "other"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
