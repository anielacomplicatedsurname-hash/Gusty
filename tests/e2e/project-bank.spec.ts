import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Demo mode (no AI key in tests): research and the voice description are clearly labelled examples.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

async function storyTab(page: Page) {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("A cycling club for older women in Leeds.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("demo-notice")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Story" }).click();
  await expect(page.getByRole("heading", { name: "Your experience" })).toBeVisible();
}

test("people add their own experience in their words, and can change or remove it", async ({ page }) => {
  await storyTab(page);
  const section = page.locator("section[aria-labelledby=experience-title]");
  await expect(section.getByText("Nothing here yet.")).toBeVisible();

  await section.getByRole("button", { name: "Add something" }).click();
  await section.getByLabel("What is it?").selectOption("win");
  await section.getByLabel("Tell it in your own words").fill("£500 from the ward fund for a summer bike club, 2024.");
  await section.getByLabel("A link, if there is one (optional)").fill("javascript:alert(1)");
  await section.getByRole("button", { name: "Add to your story" }).click();
  await expect(section.getByRole("alert")).toHaveText(/That link doesn't look right/);
  await section.getByLabel("A link, if there is one (optional)").fill("");
  await section.getByRole("button", { name: "Add to your story" }).click();

  const item = section.locator("li", { hasText: "£500 from the ward fund" });
  await expect(item.getByText("Funding or an award I've had")).toBeVisible();
  await expect(item.getByText("Your words")).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await item.getByRole("button", { name: /^Edit/ }).click();
  const editing = section.locator("li").first();
  await editing.getByLabel("Tell it in your own words").fill("£600 from the ward fund for a summer bike club, 2024.");
  await editing.getByRole("button", { name: "Save" }).click();
  await expect(section.getByText("£600 from the ward fund")).toBeVisible();
  await page.reload();
  const edited = page.locator("section[aria-labelledby=experience-title] li", { hasText: "£600 from the ward fund" });
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: /^Remove/ }).click();
  await expect(page.getByText("£600 from the ward fund")).toHaveCount(0);
});

test("research comes with its source and date, within a small daily allowance", async ({ page }) => {
  await storyTab(page);
  const section = page.locator("section[aria-labelledby=research-title]");
  await expect(section.getByText(/Research searches left today: \d of 2/)).toBeVisible();
  await section.getByRole("button", { name: "Find research" }).click();
  await expect(section.getByText("Demo mode: these are made-up examples, not real research.")).toBeVisible({ timeout: 20_000 });
  const first = section.locator("li").first();
  await expect(first.getByRole("heading", { name: "Example: a study about your kind of project" })).toBeVisible();
  await expect(first.getByText(/^Found by Gusty on .+\. Check the source before you use it in an application\.$/)).toBeVisible();
  await expect(first.getByText("Gusty's suggestion")).toBeVisible();
  // One research search per project a day.
  // (Results can show while the search is still finishing; the page checks back every few seconds.)
  await expect(section.getByText("You've already looked for research for this project today.")).toBeVisible({ timeout: 15_000 });
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await first.getByRole("button", { name: /^Remove/ }).click();
  await expect(section.getByText("Example: a study about your kind of project")).toHaveCount(0);
});

test("how someone writes is worked out behind the scenes, not shown as its own card", async ({ page }) => {
  await storyTab(page);
  await expect(page.getByRole("heading", { name: "How you write" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Research that backs your idea" })).toBeVisible();
});
