import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// Gusty's suggestions come from the AI after a step is finished. With no AI key in tests, we put one in
// directly and check what the person sees and what "Use this" and "Not now" do.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

const sql = (query: string) =>
  execFileSync("docker", ["exec", "supabase_db_gusty", "psql", "-U", "postgres", "-d", "postgres", "-qc", query]);

const fact = (page: Page, name: string) =>
  page.locator("dl > div").filter({ has: page.getByText(name, { exact: true }) });

async function newProject(page: Page) {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("A repair café in the old library. Volunteers fix things.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("demo-notice")).toBeVisible({ timeout: 15_000 });
  return page.url().split("/").pop()!;
}

function suggest(projectId: string, kind: string, value: string, reason: string) {
  sql(`insert into public.fact_suggestions (project_id, owner_id, kind, value, reason)
       select id, owner_id, '${kind}', '${value}', '${reason}' from public.projects where id = '${projectId}'`);
}

test("one living picture: what Gusty understood sits inside 'Your idea, as it stands'", async ({ page }) => {
  await newProject(page);
  const card = page.locator("section[aria-labelledby=summary-title]");
  await expect(card.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
  await expect(card.getByText("A repair café in the old library.").first()).toBeVisible();
});

test("Gusty suggests updates from a finished step; the person decides", async ({ page }) => {
  const id = await newProject(page);
  suggest(id, "audience", "Retired neighbours who like fixing things", "You mentioned retired neighbours");
  suggest(id, "place", "Hackney", "You wrote about Hackney library");
  await page.reload();

  // A quiet chip points to them; nothing has changed yet.
  await expect(page.getByRole("link", { name: "Gusty has 2 updates for your idea" })).toBeVisible();
  const box = page.locator("section[aria-labelledby=suggestions-title]");
  await expect(box.getByRole("heading", { name: "Gusty noticed something new" })).toBeVisible();
  await expect(box.getByText("Retired neighbours who like fixing things")).toBeVisible();
  await expect(box.getByText("You mentioned retired neighbours")).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // "Use this" updates what Gusty understood, confirmed by the person.
  await box.getByRole("button", { name: "Use this: Who it's for" }).click();
  await expect(box.getByText("Retired neighbours who like fixing things")).toHaveCount(0);
  const audience = fact(page, "Who it's for");
  await expect(audience.getByText("Retired neighbours who like fixing things")).toBeVisible();
  await expect(audience.getByText("Confirmed")).toBeVisible();

  // "Not now" changes nothing.
  await box.getByRole("button", { name: "Not now: Where" }).click();
  await expect(box).toHaveCount(0);
  await expect(fact(page, "Where").getByText("Hackney")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("section[aria-labelledby=suggestions-title]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /updates? for your idea/ })).toHaveCount(0);
});

test("the Notes tab says what it's for", async ({ page }) => {
  const id = await newProject(page);
  await page.goto(`/en/projects/${id}?tab=notes`);
  await expect(page.getByText("Everything you've written while doing steps, and your documents.", { exact: false })).toBeVisible();
});
