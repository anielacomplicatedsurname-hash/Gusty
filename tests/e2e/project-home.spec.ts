import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Demo mode (no AI key in tests).
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

test("a calm project home: one next step, a line of progress, four areas, and a welcome back", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toHaveCount(0);
  await page.getByLabel("What's your idea?").fill("A repair café in the old library. Volunteers fix things.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  const projectUrl = page.url();

  // New projects open on Idea, where Gusty reads them; the next step points to the plan.
  const tabs = page.getByRole("navigation", { name: "Project sections" });
  await expect(tabs.getByRole("link")).toHaveText(["Plan", "Idea", "Funding", "Story"]);
  await expect(tabs.getByRole("link", { name: "Idea" })).toHaveAttribute("aria-current", "page");
  const next = page.locator("section[aria-labelledby=next-title]");
  await expect(next.getByText("Choose where your idea could go next")).toBeVisible({ timeout: 15_000 });
  // No row of chips above the next step: stage lives in the plan, readiness in Funding.
  await expect(page.getByRole("list", { name: "Ready for funding" })).toHaveCount(0);

  await next.getByRole("link", { name: "See directions" }).click();
  await page.getByRole("button", { name: "Show me where I could go next" }).click();
  await page.getByRole("button", { name: "Choose this: Shape the idea" }).click();
  await expect(next.getByRole("heading", { name: "Write your idea in three sentences" })).toBeVisible();

  // Once there's a plan, the project opens on Plan.
  await page.goto(projectUrl);
  await expect(tabs.getByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page");
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Coming back: the home page offers to pick up where you left off.
  await page.goto("/en");
  const welcome = page.locator("section[aria-labelledby=welcome-title]");
  await expect(welcome.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();
  await expect(welcome.getByText("Next: Write your idea in three sentences")).toBeVisible();
  // One main action: the idea box waits behind "Start something new".
  await expect(page.getByLabel("What's your idea?")).toBeHidden();
  await page.getByRole("button", { name: "Start something new" }).click();
  await expect(page.getByLabel("What's your idea?")).toBeVisible();
  const homeScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(homeScan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await welcome.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(projectUrl);

  // My Projects shows where each project is at.
  await page.goto("/en/projects");
  const card = page.getByRole("list", { name: "My Projects" }).getByRole("link").first();
  await expect(card).toContainText("Next: Write your idea in three sentences");
  await expect(card).toContainText("Ready for funding: 2 of 7");
});
