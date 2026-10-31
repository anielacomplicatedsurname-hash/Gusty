import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Demo mode (no AI key in tests): routes are labelled examples, but the whole journey runs.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

test("ready for funding: what's in place, what would help next, the amount, and Gusty's routes", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("A repair café in the old library. Volunteers fix things.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);

  const section = page.locator("section[aria-labelledby=readiness-title]");
  await expect(section.getByRole("heading", { name: "Ready for funding" })).toBeVisible();
  const bar = section.getByRole("progressbar", { name: "Ready for funding" });
  await expect(bar).toHaveAttribute("aria-valuetext", "0 of 7 in place");
  // At most three next things, each a link to where it's done.
  await expect(section.getByRole("heading", { name: "What would help next" })).toBeVisible();
  await expect(section.locator("h3 + ul > li")).toHaveCount(3);

  await section.getByText("Under £1,000").click();
  await expect(section.getByText("Saved", { exact: true })).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuetext", "1 of 7 in place");
  await page.reload();
  await expect(page.locator("section[aria-labelledby=readiness-title]").getByLabel("Under £1,000")).toBeChecked();

  await section.getByRole("button", { name: "Suggest funding routes" }).click();
  await expect(section.getByRole("heading", { name: "Small grant or community pot" })).toBeVisible({ timeout: 15_000 });
  await expect(section.getByText("Demo mode: these are example routes")).toBeVisible();
  await expect(section.getByText("Gusty's estimate").first()).toBeVisible();
  await expect(section.getByRole("link", { name: "Find opportunities like these" })).toHaveAttribute("href", /\/en\/explore\?project=/);

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
