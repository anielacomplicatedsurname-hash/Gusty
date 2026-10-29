import { expect, test } from "@playwright/test";

test.describe("SEO and PWA", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport-independent");
  });

  test("home has title, description, canonical and hreflang", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/Gusty/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("placeholder pages are not indexed", async ({ page }) => {
    await page.goto("/en/connections");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("robots.txt keeps private areas out and lists the sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Disallow: /*/projects");
    expect(body).toContain("Sitemap:");
  });

  test("manifest makes the app installable", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toBe("Gusty");
    expect(manifest.display).toBe("standalone");
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).status()).toBe(200);
    }
  });
});
