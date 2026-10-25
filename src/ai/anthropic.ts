import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { configuredModel } from "./models";
import type { AiProvider, StructuredRequest, StructuredResult } from "./provider";

/**
 * Claude via the official SDK. Uses structured outputs (schema-checked JSON) and Anthropic's
 * server-side fallback, so a request an overly cautious safety check declines is retried on
 * another Claude model instead of simply failing.
 */
export function anthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  const model = configuredModel();

  return {
    name: "anthropic",
    async generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>> {
      try {
        const response = await client.beta.messages.parse({
          model,
          max_tokens: request.maxTokens ?? 8000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          output_config: { effort: request.effort ?? "medium", format: betaZodOutputFormat(request.schema) },
        });
        const usage = {
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
        if (response.stop_reason === "refusal") return { ok: false, reason: "declined", ...usage };
        if (response.stop_reason === "max_tokens" || !response.parsed_output) {
          return { ok: false, reason: "invalid", ...usage };
        }
        return { ok: true, data: response.parsed_output, ...usage };
      } catch (error) {
        const empty = { model, inputTokens: 0, outputTokens: 0 };
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          console.error("Claude API key rejected:", error.message);
          return { ok: false, reason: "unavailable", ...empty };
        }
        if (error instanceof Anthropic.RateLimitError) {
          console.error("Claude rate limit:", error.message);
          return { ok: false, reason: "unavailable", ...empty };
        }
        if (error instanceof Anthropic.APIError) {
          console.error(`Claude API error ${error.status}:`, error.message);
          return { ok: false, reason: "error", ...empty };
        }
        console.error("Claude call failed:", error);
        return { ok: false, reason: "error", ...empty };
      }
    },
  };
}
