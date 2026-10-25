/** Default model for Gusty's tasks. Override with GUSTY_AI_MODEL (server-only). */
export const DEFAULT_MODEL = "claude-opus-5-5";

export function configuredModel(): string {
  return process.env.GUSTY_AI_MODEL?.trim() || DEFAULT_MODEL;
}

/** US dollars per million tokens (Anthropic list prices, Oct 2026). Used for the usage log. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/** Estimated cost of one call. Unknown models are priced at the most expensive rate, never as free. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model] ?? PRICES["claude-fable-5-1"];
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
