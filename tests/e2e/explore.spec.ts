import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Demo mode (no AI key in tests): the results are labelled made-up examples, but the whole journey runs.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

test("Explore starts from a project and isn't indexed", async ({ page }) => {
  await page.goto("/en/explore");
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
  await expect(page.getByText("Explore works from one of your projects.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByRole("link", { name: "Start with your idea" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("searching for a project's opportunities: best places first, the rest by scale, honestly labelled", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("A repair café in the old library. Volunteers fix things.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);

  await page.getByRole("link", { name: "Find opportunities" }).click();
  await expect(page).toHaveURL(/\/en\/explore\?project=[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Opportunities for / })).toBeVisible();
  await expect(page.getByText("never your name or email")).toBeVisible();
  await page.getByLabel("Where is the project?").fill("Hackney, London, UK");
  await page.getByRole("button", { name: "Search online for this project" }).click();

  // The search runs in the background; the page checks back by itself.
  const best = page.locator("section[aria-labelledby=best-title]");
  await expect(best.getByRole("article")).toHaveCount(3, { timeout: 20_000 });
  await expect(page.getByText("Demo mode: these are made-up examples")).toBeVisible();
  await expect(page.getByText(/Found online on .* around Hackney, London, UK\. Not checked by Gusty/)).toBeVisible();
  const first = best.getByRole("article").first();
  await expect(first.getByText("Neighbourhood", { exact: true })).toBeVisible();
  await expect(first.getByText("Light to apply", { exact: false }).first()).toBeVisible();
  await expect(first.getByText("Why it might fit")).toBeVisible();
  await expect(first.getByRole("link", { name: /Read more on their site/ })).toHaveAttribute("href", /^https:\/\//);

  // Everything else is folded away by scale.
  const more = page.locator("section[aria-labelledby=more-title]");
  await expect(more.getByRole("article")).toBeHidden();
  await more.locator("summary", { hasText: "International" }).click();
  await expect(more.getByRole("article")).toHaveCount(1);

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // One search per project per day; the results stay.
  await page.reload();
  await expect(page.getByText("You can search again for this project tomorrow.")).toBeVisible();
  await expect(best.getByRole("article")).toHaveCount(3);
});
