import type { Material } from "./data";

/** The same question can be worded slightly differently in two papers: compare without case or punctuation. */
export const keyOf = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 600);

export type Question = { key: string; question: string; limit: string; help: string };

/** Every question across the funder's papers, in order, each once. */
export function questionsOf(materials: Material[]): Question[] {
  const out = new Map<string, Question>();
  for (const m of materials) {
    for (const q of m.reading.questions ?? []) {
      const key = keyOf(q.question);
      if (!key) continue;
      const existing = out.get(key);
      if (!existing) out.set(key, { key, question: q.question, limit: q.limit, help: q.help });
      else {
        if (!existing.limit && q.limit) existing.limit = q.limit;
        if (!existing.help && q.help) existing.help = q.help;
      }
    }
  }
  return [...out.values()];
}
