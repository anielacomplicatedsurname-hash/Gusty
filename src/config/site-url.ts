const fallback = "http://localhost:3000";

/**
 * The site's public origin, used for canonical links, sitemap and Open Graph.
 * Tolerates the ways a hosting setting is commonly entered: blank, untrimmed,
 * without "https://", or with a trailing slash. Falls back to Render's own
 * address, then to localhost, rather than failing the build.
 */
export function resolveSiteUrl(
  configured = process.env.NEXT_PUBLIC_SITE_URL,
  platform = process.env.RENDER_EXTERNAL_URL,
): string {
  for (const candidate of [configured, platform]) {
    const value = candidate?.trim();
    if (!value) continue;
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      return new URL(withScheme).origin;
    } catch {
      // Not a usable address; try the next candidate.
    }
  }
  return fallback;
}
