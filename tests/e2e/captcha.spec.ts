import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Runs only when the server has a Turnstile site key (for example Cloudflare's always-pass test key
// 1x00000000000000000000AA). Cloudflare's script is replaced by a stand-in that adds a token, so the test
// doesn't depend on Cloudflare being reachable.
test.skip(!process.env.E2E_SUPABASE || !process.env.TURNSTILE_SITE_KEY, "needs E2E_SUPABASE=1 and TURNSTILE_SITE_KEY");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

async function fakeTurnstile(page: Page) {
  let loads = 0;
  await page.route("https://challenges.cloudflare.com/**", (route) => {
    loads++;
    return route.fulfill({
      contentType: "text/javascript",
      body: `window.turnstile = {
        render(el, options) {
          window.turnstileOptions = options;
          // Like Cloudflare: the field is there at once, the token arrives a moment later.
          const input = document.createElement("input");
          input.type = "hidden"; input.name = "cf-turnstile-response"; input.value = "";
          el.appendChild(input);
          setTimeout(() => { input.value = "test-token-" + Math.random(); options.callback?.(input.value); }, window.turnstileDelay ?? 0);
          return "w" + Math.random();
        },
        reset() {}, remove() {},
      };`,
    });
  });
  return () => loads;
}

test("first-time visitors get the bot check on the idea box; once they have a session, it's gone", async ({ page }) => {
  const loads = await fakeTurnstile(page);
  await page.goto("/en");
  const form = page.locator("form").filter({ has: page.getByLabel("What's your idea?") });
  await expect(form.getByText("Cloudflare checks this browser isn't a bot")).toBeVisible();
  await expect(form.locator('input[name="cf-turnstile-response"]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { turnstileOptions: { appearance: string; language: string } }).turnstileOptions))
    .toMatchObject({ appearance: "interaction-only", language: "en" });
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await page.getByLabel("What's your idea?").fill("A tool library in the community centre.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);

  const before = loads();
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();
  await page.getByRole("button", { name: "Start something new" }).click();
  await expect(page.getByLabel("What's your idea?")).toBeVisible();
  await expect(page.getByText("Cloudflare checks this browser isn't a bot")).toHaveCount(0);
  await page.goto("/en/feedback");
  await expect(page.getByLabel("What worked well?")).toBeVisible();
  await expect(page.getByText("Cloudflare checks this browser isn't a bot")).toHaveCount(0);
  expect(loads()).toBe(before);

  // Guests still get it for the email link, which is a sign-in.
  await page.goto("/en/projects");
  await expect(page.getByText("Cloudflare checks this browser isn't a bot")).toHaveCount(1);
});

test("if Cloudflare can't be reached, the forms still work", async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
  await page.goto("/en/feedback");
  await page.getByLabel("What worked well?").fill("Calm and clear.");
  await page.getByRole("button", { name: "Send my thoughts" }).click();
  await expect(page.getByText("Thank you", { exact: false }).first()).toBeVisible();
});

test("pressing the button before the check has finished waits for it, then sends the token", async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { turnstileDelay: number }).turnstileDelay = 2500; });
  await fakeTurnstile(page);
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("A reading circle at the launderette.");
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/en");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  expect((await sent).postData() ?? "").toMatch(/cf-turnstile-response[\s\S]*test-token-/);
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
});
