import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Demo mode (no AI key in tests): exercises the whole journey except the model calls.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

async function projectWithSteps(page: Page) {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("A repair café in the old library. Volunteers fix things.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Show me where I could go next" }).click({ timeout: 15_000 });
  await expect(page.getByText("Gusty recommends starting here")).toBeVisible();
  await page.getByRole("button", { name: "Choose this: Shape the idea" }).click();
  await expect(page.getByText("Start here", { exact: true })).toBeVisible();
}

const mode = (page: Page, name: string) => page.locator("label", { hasText: name });
const stepTitle = (page: Page, name: string) => page.getByRole("heading", { level: 4, name });

test("choosing a direction gives small steps, the first one highlighted", async ({ page }) => {
  await projectWithSteps(page);
  await expect(page.getByText("Your direction")).toBeVisible();
  await expect(stepTitle(page, "Write your idea in three sentences")).toBeVisible();
  await expect(page.locator("ol[aria-label='Your next steps'] > li")).toHaveCount(3);
});

test("modes change how much is shown, never the steps", async ({ page }) => {
  await projectWithSteps(page);
  await mode(page, "Keep it simple").click();
  await expect(page.locator("ol[aria-label='Your next steps'] > li")).toHaveCount(1);
  await expect(page.getByText("2 more steps are waiting")).toBeVisible();

  await page.reload();
  await expect(page.locator("ol[aria-label='Your next steps'] > li")).toHaveCount(1);

  await mode(page, "Let me see everything").click();
  await expect(page.locator("ol[aria-label='Your next steps'] > li")).toHaveCount(3);
});

test("ticking a step off keeps it, and progress survives a reload", async ({ page }) => {
  await projectWithSteps(page);
  await page.getByLabel("Done: Write your idea in three sentences").check();
  await expect(page.getByText("1 done so far")).toBeVisible();
  await expect(page.getByText("Start here", { exact: true })).toBeVisible();
  await expect(stepTitle(page, "List three people you could tell about it")).toBeVisible();

  await page.reload();
  await expect(page.getByText("1 done so far")).toBeVisible();
  await mode(page, "Let me see everything").click();
  await expect(page.getByLabel("Not done yet: Write your idea in three sentences")).toBeChecked();
});

test("I'm stuck: make it smaller replaces the step with smaller ones", async ({ page }) => {
  await projectWithSteps(page);
  await page.getByRole("button", { name: "I'm stuck" }).first().click();
  await page.getByRole("button", { name: "Make this smaller" }).click();
  await expect(stepTitle(page, "Open a blank note")).toBeVisible({ timeout: 15_000 });
  await expect(stepTitle(page, "Write your idea in three sentences")).toHaveCount(0);
});

test("I'm stuck: help me start and explain it differently add help to the step", async ({ page }) => {
  await projectWithSteps(page);
  await page.getByRole("button", { name: "I'm stuck" }).first().click();
  await page.getByRole("button", { name: "Help me start" }).click();
  await expect(page.getByText("A way to begin")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "I'm stuck" }).first().click();
  await page.getByRole("button", { name: "Explain it differently" }).click();
  await expect(page.getByText("Another way to look at it")).toBeVisible({ timeout: 15_000 });
});

test("people can add their own step", async ({ page }) => {
  await projectWithSteps(page);
  await mode(page, "Let me see everything").click();
  await page.getByRole("button", { name: "+ Add your own step" }).click();
  await page.getByLabel("Add your own step").fill("Ask the librarian about Saturdays");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(stepTitle(page, "Ask the librarian about Saturdays")).toBeVisible();
  await expect(page.getByText("Your step")).toBeVisible();
});

test("the full project page has no detectable accessibility violations", async ({ page }) => {
  await projectWithSteps(page);
  await page.getByRole("button", { name: "I'm stuck" }).first().click();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
});
