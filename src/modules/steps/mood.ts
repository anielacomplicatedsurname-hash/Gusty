/** The kinds of work a step can be, so people can choose by how they feel today. */
export const MOODS = ["social", "writing", "planning", "research", "making"] as const;
export type Mood = (typeof MOODS)[number];

export const isMood = (value: unknown): value is Mood => typeof value === "string" && (MOODS as readonly string[]).includes(value);

// Words that usually signal each kind of work. Matched as whole words at the start of a word, so "ask"
// matches "asking" but not "task".
const WORDS: Record<Mood, string[]> = {
  social: ["talk", "ask", "tell", "meet", "call", "chat", "invite", "message", "email", "share", "phone", "visit",
    "introduce", "speak", "contact", "reach out", "neighbour", "volunteer", "partner", "interview", "conversation"],
  writing: ["write", "draft", "describe", "summarise", "summarize", "rewrite", "note", "journal", "paragraph",
    "sentence", "story", "pitch", "word", "caption", "letter", "blurb"],
  planning: ["plan", "decide", "choose", "list", "budget", "schedule", "timeline", "prioritise", "prioritize",
    "set a date", "map out", "outline", "organise", "organize", "goal", "next month", "calendar"],
  research: ["find", "look up", "research", "search", "check", "read", "compare", "explore", "learn", "watch",
    "see what", "look into", "investigate", "browse", "study", "find out"],
  making: ["make", "build", "sketch", "draw", "design", "try", "test", "prototype", "photograph", "photo", "film",
    "record", "cook", "paint", "craft", "print", "set up", "create", "mock"],
};

// Drawing or sketching a route, map or timeline is planning, not making.
const PLANNING_SHAPE = /\b(sketch|draw|map|plot|trace|work out)\b.*\b(route|map|plan|timeline|schedule|itinerary|loop|path|budget)/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERNS = Object.fromEntries(
  MOODS.map((m) => [m, WORDS[m].map((w) => new RegExp(`\\b${escape(w)}`, "i"))]),
) as Record<Mood, RegExp[]>;

/** How strongly a step's words point to each kind of work. The title counts double; its first word most. */
export function moodScores(step: { title: string; detail?: string | null }): Record<Mood, number> {
  const first = step.title.trim().split(/\s+/)[0] ?? "";
  const scores = Object.fromEntries(MOODS.map((m) => [m, 0])) as Record<Mood, number>;
  for (const m of MOODS) {
    for (const p of PATTERNS[m]) {
      if (p.test(first)) scores[m] += 3;
      if (p.test(step.title)) scores[m] += 2;
      if (step.detail && p.test(step.detail)) scores[m] += 1;
    }
  }
  if (PLANNING_SHAPE.test(step.title)) scores.planning += 8;
  return scores;
}

/** The kind of work the step's words point to most, or null when nothing fits. */
export function guessMood(step: { title: string; detail?: string | null }): Mood | null {
  const scores = moodScores(step);
  let best: Mood | null = null;
  for (const m of MOODS) if (scores[m] > 0 && (best === null || scores[m] > scores[best])) best = m;
  return best;
}

/**
 * The step's kind of work: the one it was given, unless its own words clearly say otherwise (for example
 * "Write an invite" saved as talking to people), otherwise the best guess from its words.
 */
export function moodOf(step: { title: string; detail?: string | null; mood?: string | null }): Mood | null {
  const scores = moodScores(step);
  const guess = guessMood(step);
  if (isMood(step.mood)) {
    return guess && guess !== step.mood && scores[guess] - scores[step.mood] >= 3 ? guess : step.mood;
  }
  return guess;
}
