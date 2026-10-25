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

/**
 * Where a page request should go instead, if it arrived on another public address for the same site
 * (e.g. gusty-web.onrender.com or www.heygusty.com once heygusty.com is the real one). Keeps one address
 * for search engines and sign-in. Local and preview hosts are left alone.
 */
export function canonicalRedirect(requestHost: string | null, siteUrl: string): string | null {
  if (!requestHost) return null;
  const host = requestHost.toLowerCase().split(":")[0];
  const site = new URL(siteUrl);
  if (host === site.hostname || site.hostname === "localhost") return null;
  const isRenderAddress = host.endsWith(".onrender.com");
  const isWww = host === `www.${site.hostname}`;
  return isRenderAddress || isWww ? site.origin : null;
}
