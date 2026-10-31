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
        type Params = Parameters<typeof client.beta.messages.parse>[0];
        const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
          ...(request.documents ?? []).map((d) => ({
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: d.base64 },
          })),
          { type: "text", text: request.user },
        ];
        const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content }];
        const toolList: NonNullable<Params["tools"]> = [];
        if (request.webSearch) toolList.push({ type: "web_search_20260209", name: "web_search", max_uses: request.webSearch.maxUses });
        if (request.webFetch) toolList.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: request.webFetch.maxUses });
        const tools = toolList.length ? toolList : undefined;
        const send = () =>
          client.beta.messages.parse({
            model,
            max_tokens: request.maxTokens ?? 8000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: request.system,
            messages,
            tools,
            output_config: { effort: request.effort ?? "medium", format: betaZodOutputFormat(request.schema) },
          }, request.timeoutMs ? { timeout: request.timeoutMs } : undefined);
        let response = await send();
        let inputTokens = response.usage.input_tokens;
        let outputTokens = response.usage.output_tokens;
        let webSearches = response.usage.server_tool_use?.web_search_requests ?? 0;
        // A long server-side tool loop can pause; resending the turn lets it carry on (twice, unless asked otherwise).
        for (let i = 0; i < (request.maxContinuations ?? 2) && response.stop_reason === "pause_turn"; i++) {
          messages.push({ role: "assistant", content: response.content as Anthropic.Beta.Messages.BetaContentBlockParam[] });
          response = await send();
          inputTokens += response.usage.input_tokens;
          outputTokens += response.usage.output_tokens;
          webSearches += response.usage.server_tool_use?.web_search_requests ?? 0;
        }
        const usage = { model: response.model, inputTokens, outputTokens, webSearches };
        if (response.stop_reason === "refusal") return { ok: false, reason: "declined", ...usage };
        if (response.stop_reason === "max_tokens" || response.stop_reason === "pause_turn" || !response.parsed_output) {
          return { ok: false, reason: "invalid", ...usage };
        }
        return { ok: true, data: response.parsed_output, ...usage };
      } catch (error) {
        const empty = { model, inputTokens: 0, outputTokens: 0 };
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          console.error("Claude API key rejected:", error.message);
          return { ok: false, reason: "key", ...empty };
        }
        if (error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && error.status === 529)) {
          console.error("Claude busy:", error.message);
          return { ok: false, reason: "busy", ...empty };
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
