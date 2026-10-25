import type { z } from "zod";

/** Result of one structured AI call, with what's needed for the usage log. */
export type StructuredResult<T> =
  | { ok: true; data: T; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; reason: "declined" | "invalid" | "unavailable" | "error"; model: string; inputTokens: number; outputTokens: number };

export type StructuredRequest<S extends z.ZodType> = {
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

/** A model provider. Tasks depend on this, never on a vendor SDK directly. */
export interface AiProvider {
  readonly name: string;
  generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>>;
}
