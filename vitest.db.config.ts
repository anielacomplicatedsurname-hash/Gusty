import { defineConfig } from "vitest/config";
import path from "node:path";

// Locally, read NEXT_PUBLIC_SUPABASE_* from .env.local; CI sets them in the environment.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the environment.
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/db/**/*.test.ts"] },
});
