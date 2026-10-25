import { anthropicProvider } from "./anthropic";
import type { AiProvider } from "./provider";

/** The configured provider, or null when no key is set (the app then uses labelled demo output). */
export function aiProvider(): AiProvider | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? anthropicProvider(key) : null;
}
