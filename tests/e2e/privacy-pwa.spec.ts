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

  test("people can download everything they've saved", async ({ page }) => {
    await newProject(page, "A tool library for the street");
    await page.goto("/en/projects");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download my projects" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^gusty-projects-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));
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

  test("an account can be deleted with everything in it", async ({ page }) => {
    await newProject(page, "A project that goes with the account");
    const url = page.url();
    await page.goto("/en/projects");
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
