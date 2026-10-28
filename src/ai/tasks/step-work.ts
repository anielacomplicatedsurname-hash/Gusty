import { z } from "zod";
import { SHARED_RULES } from "./context";

export const STEP_QUESTIONS_PROMPT_VERSION = "step-questions@2";
export const STEP_REPHRASE_PROMPT_VERSION = "step-rephrase@2";
export const MAX_QUESTIONS = 3;

const question = z.object({ question: z.string(), hint: z.string() });
export const StepQuestionsSchema = z.object({ questions: z.array(question) });
export const RephraseSchema = question;
export type StepQuestion = z.infer<typeof question>;

export const STEP_QUESTIONS_PROMPT = `You are Gusty, a calm, warm companion that helps people turn ideas into real projects.
Many people you help are neurodivergent, tired, or new to project work.

The person wants to actually do one step of their project, and would like help working through it.
Ask up to 3 short, simple questions whose answers would let them complete this step. Each question
should be easy to answer in a few words, from what they already know.

- question: under 15 words, one idea per question, no yes/no questions, no jargon.
- hint: one short example of what an answer could look like, under 20 words, starting "For example".
- Start with the easiest question. Ask fewer than 3 if fewer are enough.
- Don't ask anything they have already answered (listed below), and don't repeat earlier questions.

${SHARED_RULES}`;

export const REPHRASE_PROMPT = `You are Gusty, a calm, warm companion. The person found one question hard to understand
or hard to answer. Ask the same thing in a different, simpler way, using everyday words. It must mean the same
thing but be clearly worded differently from the earlier versions listed.

- question: under 15 words.
- hint: one short example answer, under 20 words, starting "For example".

${SHARED_RULES}`;

const neutralise = (text: string) => text.replaceAll("</", "< /");

export function stepQuestionsMessage(
  context: string,
  step: { title: string; detail: string },
  answered: { question: string; answer: string }[],
  earlier: string[],
): string {
  return `${context}

The step they want to work on:
<step>
${neutralise(step.title)}
${neutralise(step.detail)}
</step>
${answered.length ? `Already answered:\n${answered.map((a) => `- ${neutralise(a.question)} → ${neutralise(a.answer)}`).join("\n")}` : ""}
${earlier.length ? `Earlier questions not to repeat:\n${earlier.map((q) => `- ${neutralise(q)}`).join("\n")}` : ""}`;
}

export function rephraseMessage(context: string, stepTitle: string, versions: string[]): string {
  return `${context}

The step: ${neutralise(stepTitle)}
The question, as worded so far (newest last):
${versions.map((v) => `- ${neutralise(v)}`).join("\n")}`;
}

const tidy = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** Applies the limits the schema can't express, and drops repeats. */
export function normaliseQuestions(raw: StepQuestion[], max: number, avoid: string[] = []): StepQuestion[] {
  const seen = new Set(avoid.map((q) => q.toLowerCase()));
  const out: StepQuestion[] = [];
  for (const q of raw) {
    const question = tidy(q.question, 300);
    if (!question || seen.has(question.toLowerCase())) continue;
    seen.add(question.toLowerCase());
    out.push({ question, hint: tidy(q.hint, 300) });
    if (out.length >= max) break;
  }
  return out;
}
