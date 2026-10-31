import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe("data controls", () => {
  test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport-independent");
  });

  async function newProject(page: Page, idea: string) {
    await page.goto("/en");
    await page.getByLabel("What's your idea?").fill(idea);
    await page.getByRole("button", { name: "Start with my idea" }).click();
    await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  }

  const read = async (download: import("@playwright/test").Download) =>
    (await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));

  test("people can download everything they've saved, as a readable document or a data file", async ({ page }) => {
    await newProject(page, "A tool library for the street");
    await page.goto("/en/projects");
    await page.getByRole("link", { name: "Your account and data" }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    const [doc] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download my projects" }).click()]);
    expect(doc.suggestedFilename()).toMatch(/^gusty-projects-\d{4}-\d{2}-\d{2}\.txt$/);
    const text = await read(doc);
    expect(text).toContain("Your projects in Gusty");
    expect(text).toContain("Your idea");
    expect(text).toContain("A tool library for the street");
    expect(text).not.toContain("{");

    const [data] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /as a data file/ }).click()]);
    expect(data.suggestedFilename()).toMatch(/^gusty-projects-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse(await read(data));
    expect(json.projects).toHaveLength(1);
    expect(json.projects[0].idea).toBe("A tool library for the street");
  });

  test("the export is refused without a session", async ({ request }) => {
    expect((await request.get("/api/export")).status()).toBe(401);
  });

  test("a project can be deleted after confirming", async ({ page }) => {
    await newProject(page, "A project to delete");
    const url = page.url();
    await page.getByRole("button", { name: "Delete this project" }).click();
    await page.getByRole("button", { name: "Yes, delete this project" }).click();
    await expect(page).toHaveURL(/\/en\/projects$/);
    await expect(page.getByText("No projects yet")).toBeVisible();
    await page.goto(url);
    await expect(page.getByText("We couldn't find that project.")).toBeVisible();
  });

  test("a project can be deleted from My Projects, only after typing its name", async ({ page }) => {
    await newProject(page, "A seed swap for the street");
    await page.goto("/en/projects");
    const title = (await page.getByRole("list", { name: "My Projects" }).getByRole("link").first().locator("span.text-lg").textContent())!;
    await page.getByRole("button", { name: `Delete project: ${title}` }).click();
    const box = page.getByRole("group", { name: `Delete project: ${title}` });
    await expect(box.getByText("It can't be brought back.", { exact: false })).toBeVisible();
    const forever = box.getByRole("button", { name: "Delete it for ever" });
    await expect(forever).toBeDisabled();
    await box.getByLabel(/To be sure, type the project's name/).fill("something else");
    await expect(forever).toBeDisabled();
    await box.getByLabel(/To be sure, type the project's name/).fill(`  ${title.toUpperCase()} `);
    await forever.click();
    await expect(page.getByText("No projects yet")).toBeVisible();
  });

  test("an account can be deleted with everything in it", async ({ page }) => {
    await newProject(page, "A project that goes with the account");
    const url = page.url();
    await page.goto("/en/account");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Yes, delete everything" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/en/projects");
    await expect(page.getByRole("heading", { name: "Find your projects" })).toBeVisible();
    await page.goto(url);
    await expect(page.getByText("We couldn't find that project.")).toBeVisible();
  });
});

test.describe("installable app and security headers", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport-independent");
  });

  test("security headers are set and nothing is blocked on the main pages", async ({ page }) => {
    const blocked: string[] = [];
    page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) blocked.push(m.text()); });
    const response = await page.goto("/en");
    const csp = response!.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response!.headers()["strict-transport-security"]).toContain("max-age=");
    await page.goto("/en/explore");
    await page.goto("/en/projects");
    expect(blocked).toEqual([]);
  });

  test("when offline, pages show a calm offline message instead of a browser error", async ({ page, context }) => {
    await page.goto("/en");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // the page is now controlled by the service worker
    await context.setOffline(true);
    await page.goto("/en/explore").catch(() => {});
    await expect(page.getByRole("heading", { name: "You're offline right now." })).toBeVisible();
    await context.setOffline(false);
  });

  test("sign-in links can't be turned into a redirect to another site", async ({ request, baseURL }) => {
    for (const next of ["//evil.example", "/%09/evil.example", "/%0a/evil.example", "https://evil.example"]) {
      const response = await request.get(`/api/auth/confirm?next=${next}`, { maxRedirects: 0 });
      expect(new URL(response.headers().location).origin).toBe(new URL(baseURL!).origin);
    }
  });

  test("a sign-in code that lands on the home page is still used to sign in", async ({ request, baseURL }) => {
    const response = await request.get("/?code=not-a-real-code", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const location = new URL(response.headers().location, baseURL);
    expect(location.origin).toBe(new URL(baseURL!).origin);
    expect(location.pathname + location.search).toBe("/api/auth/confirm?code=not-a-real-code");
  });

  test("the service worker never caches private pages", async ({ request }) => {
    const sw = await (await request.get("/sw.js")).text();
    // Pages go straight to the network; the only cache.put is inside the static-asset branch.
    expect(sw).toContain('event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))');
    expect(sw.match(/cache\.put/g)).toHaveLength(1);
    expect(sw.indexOf("cache.put")).toBeGreaterThan(sw.indexOf("if (isStaticAsset(url))"));
    for (const prefix of ["/_next/static/", "/brand/", "/icons/"]) expect(sw).toContain(`startsWith("${prefix}")`);
    expect(sw.match(/startsWith\(/g)).toHaveLength(3);
  });
});

test.describe("support", () => {
  test("the support card offers one-off and monthly support through Stripe", async ({ page }) => {
    await page.goto("/en");
    const card = page.locator("section[aria-labelledby=support-title]");
    await expect(card.getByRole("heading", { name: "Help Gusty take off!" })).toBeVisible();
    for (const amount of ["£3", "£5", "£10", "Other amount"]) {
      await expect(card.getByRole("link", { name: amount, exact: true })).toHaveAttribute("href", /^https:\/\/buy\.stripe\.com\//);
    }
    await card.getByText("Monthly", { exact: true }).click();
    await expect(card.getByRole("link", { name: "£5 a month" })).toHaveAttribute("href", /^https:\/\/buy\.stripe\.com\//);
    await expect(card.getByRole("link", { name: "Other amount" })).toHaveCount(0);
    await expect(card.getByRole("link", { name: "Manage or stop a monthly contribution" })).toHaveAttribute("href", /^https:\/\/billing\.stripe\.com\//);
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(scan.violations).toEqual([]);

    await card.getByRole("link", { name: "Changed your mind? How to stop or get a refund" }).click();
    await expect(page).toHaveURL(/\/en\/support#help$/);
    await expect(page.getByRole("heading", { name: "Changed your mind? No worries." })).toBeVisible();

    await page.goto("/en");
    await page.getByRole("link", { name: "Support Gusty" }).click();
    await expect(page).toHaveURL(/\/en\/support$/);
    await expect(page.getByRole("heading", { name: "Help Gusty take off!" })).toBeVisible();
  });

  test("the thank-you page is calm and kept out of search engines", async ({ page }) => {
    await page.goto("/en/thank-you");
    await expect(page.getByRole("heading", { level: 1, name: "Thanks for the lift!" })).toBeVisible();
    await expect(page.getByText("Stripe has sent a receipt to your email.")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // How to stop or get a refund is right there after paying.
    const help = page.locator("#help");
    await expect(help.getByRole("heading", { name: "Changed your mind? No worries." })).toBeVisible();
    await expect(help.getByText("within 14 days of your payment")).toBeVisible();
    await expect(help.getByRole("link", { name: "hello@heygusty.com" })).toHaveAttribute("href", /^mailto:hello@heygusty\.com/);
    await expect(help.getByRole("link", { name: "Email us about a refund" })).toHaveAttribute("href", /^mailto:hello@heygusty\.com/);
    await expect(help.getByRole("link", { name: "Manage your monthly contribution" })).toHaveAttribute("href", /^https:\/\/billing\.stripe\.com\//);
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(scan.violations).toEqual([]);
  });
});
