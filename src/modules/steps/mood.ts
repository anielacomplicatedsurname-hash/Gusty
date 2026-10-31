/** The kinds of work a step can be, so people can choose by how they feel today. */
export const MOODS = ["social", "writing", "planning", "research", "making"] as const;
export type Mood = (typeof MOODS)[number];

export const isMood = (value: unknown): value is Mood => typeof value === "string" && (MOODS as readonly string[]).includes(value);

// Words that usually signal each kind of work. Matched as whole words at the start of a word, so "ask"
// matches "asking" but not "task".
const WORDS: Record<Mood, string[]> = {
  social: ["talk", "ask", "tell", "meet", "call", "chat", "invite", "message", "email", "share", "phone", "visit",
    "introduce", "speak", "contact", "reach out", "people", "neighbour", "friend", "volunteer", "partner", "interview"],
  writing: ["write", "draft", "describe", "summarise", "summarize", "rewrite", "note", "journal", "paragraph",
    "sentence", "story", "pitch", "word", "caption", "letter", "blurb"],
  planning: ["plan", "decide", "choose", "list", "budget", "schedule", "timeline", "prioritise", "prioritize",
    "set a date", "map out", "outline", "organise", "organize", "goal", "next month", "calendar"],
  research: ["find", "look up", "research", "search", "check", "read", "compare", "explore", "learn", "watch",
    "see what", "look into", "investigate", "browse", "study", "find out"],
  making: ["make", "build", "sketch", "draw", "design", "try", "test", "prototype", "photograph", "photo", "film",
    "record", "cook", "paint", "craft", "print", "set up", "create", "mock"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERNS = Object.fromEntries(
  MOODS.map((m) => [m, WORDS[m].map((w) => new RegExp(`\\b${escape(w)}`, "i"))]),
) as Record<Mood, RegExp[]>;

/**
 * The step's kind of work: the one it was given, or the best guess from its words. The title counts double,
 * and its first word (usually the verb) counts most. Null when nothing fits clearly.
 */
export function moodOf(step: { title: string; detail?: string | null; mood?: string | null }): Mood | null {
  if (isMood(step.mood)) return step.mood;
  const first = step.title.trim().split(/\s+/)[0] ?? "";
  let best: Mood | null = null;
  let bestScore = 0;
  for (const m of MOODS) {
    let score = 0;
    for (const p of PATTERNS[m]) {
      if (p.test(first)) score += 3;
      if (p.test(step.title)) score += 2;
      if (step.detail && p.test(step.detail)) score += 1;
    }
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}
