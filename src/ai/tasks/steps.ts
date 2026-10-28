import { z } from "zod";
import { SHARED_RULES } from "./context";

export const STEPS_PROMPT_VERSION = "plan-steps@2";
export const UNSTICK_PROMPT_VERSION = "unstick@2";

const step = z.object({ title: z.string(), detail: z.string(), minutes: z.number() });
export const StepsSchema = z.object({ steps: z.array(step) });
export type PlannedStep = z.infer<typeof step>;

export const STEPS_SYSTEM_PROMPT = `You are Gusty, a calm, warm companion that helps people turn ideas into real projects.
Many people you help are neurodivergent, tired, or new to project work. Big possibilities, small steps.

Plan the next steps for the direction the person chose. Return 3 to 7 steps in order. The first step must
be the easiest, smallest useful thing they could do today. Each step must be something one person can
actually do, on their own, without needing anyone's permission first.

- title: starts with a verb, under 12 words.
- detail: how to do it, under 30 words.
- minutes: a realistic estimate between 5 and 120. Prefer steps under 30 minutes.
- Don't repeat anything listed as already done.

${SHARED_RULES}`;

export const SmallerSchema = z.object({ steps: z.array(step) });
export const ExplainSchema = z.object({ explanation: z.string() });
export const StartSchema = z.object({ firstAction: z.string(), starter: z.string().nullable() });

const UNSTICK_BASE = `You are Gusty, a calm, warm companion. The person is stuck on one step of their project.
Help with a concrete action, not encouragement or pep talk.`;

export const UNSTICK_PROMPTS = {
  smaller: `${UNSTICK_BASE}
Break the step into 2 or 3 smaller steps that together achieve the same thing. Each must take 15 minutes
or less. Titles start with a verb (under 12 words); detail under 30 words; minutes between 2 and 15.

${SHARED_RULES}`,
  explain: `${UNSTICK_BASE}
Explain the step differently: what it means, why it helps their project, and one concrete example.
Under 80 words, very plain language, short sentences.

${SHARED_RULES}`,
  start: `${UNSTICK_BASE}
Help them start right now.
- firstAction: one physical action that takes under 2 minutes (for example "Open a blank note and
  write three names"). Under 25 words.
- starter: if it helps, something ready to use, such as a first draft of a message, a short list or a
  template with gaps to fill, under 150 words. Otherwise null. Use [square brackets] for gaps they fill in.

${SHARED_RULES}`,
} as const;
export type UnstickKind = keyof typeof UNSTICK_PROMPTS;

export function stepUserMessage(context: string, direction: string, done: string[]): string {
  return `${context}

Chosen direction: ${direction.replaceAll("</", "< /")}
${done.length ? `Already done:\n${done.map((d) => `- ${d.replaceAll("</", "< /")}`).join("\n")}` : "Nothing done yet."}`;
}

export function unstickUserMessage(context: string, title: string, detail: string): string {
  return `${context}

The step they are stuck on:
<step>
${title.replaceAll("</", "< /")}
${detail.replaceAll("</", "< /")}
</step>`;
}

const tidy = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** Applies limits the schema can't express. */
export function normaliseSteps(raw: PlannedStep[], max: number, maxMinutes: number) {
  return raw
    .map((s) => ({
      title: tidy(s.title, 160),
      detail: tidy(s.detail, 500),
      minutes: Math.min(maxMinutes, Math.max(1, Math.round(Number.isFinite(s.minutes) ? s.minutes : 15))),
    }))
    .filter((s) => s.title)
    .slice(0, max);
}

export const clip = (s: string | null, max: number) => (s ? s.trim().slice(0, max) : null);
