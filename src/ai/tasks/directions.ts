import { z } from "zod";
import { SHARED_RULES } from "./context";

export const DIRECTIONS_PROMPT_VERSION = "suggest-directions@2";

export const DirectionsSchema = z.object({
  directions: z.array(z.object({ label: z.string(), reason: z.string(), recommended: z.boolean() })),
});
export type Directions = z.infer<typeof DirectionsSchema>;

export const DIRECTIONS_SYSTEM_PROMPT = `You are Gusty, a calm, warm companion that helps people turn ideas into real projects.
Many people you help are neurodivergent, tired, or new to project work.

Suggest up to 3 directions this project could focus on next, for the coming few weeks. A direction is a
broad area of focus, for example "Shape the idea", "Try a small version", "Find your first helpers",
"Get ready to ask for money". Choose only directions that genuinely fit this project and its stage.
Fewer is better than padding.

- label: 2 to 5 words.
- reason: one short sentence (under 20 words) on why it fits *their* project.
- recommended: true for exactly one direction, the most useful place to start.

${SHARED_RULES}`;

export function normaliseDirections(raw: Directions) {
  const tidy = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
  const list = raw.directions
    .map((d) => ({ label: tidy(d.label, 80), reason: tidy(d.reason, 300), recommended: d.recommended }))
    .filter((d) => d.label)
    .slice(0, 3);
  const firstRecommended = Math.max(0, list.findIndex((d) => d.recommended));
  return list.map((d, i) => ({ ...d, recommended: i === firstRecommended }));
}
