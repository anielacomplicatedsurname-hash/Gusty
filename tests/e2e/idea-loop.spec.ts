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
  await expect(box.getByRole("heading", { name: "Gusty would like to check something" })).toBeVisible();
  await expect(box.getByText("Retired neighbours who like fixing things")).toBeVisible();
  await expect(box.getByText("You mentioned retired neighbours")).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // "Use this" updates what Gusty understood, confirmed by the person.
  await box.getByRole("button", { name: "Use this: Who it's for" }).click();
  await expect(box.getByText("Retired neighbours who like fixing things")).toHaveCount(0);
  const audience = fact(page, "Who it's for");
  await expect(audience.getByText("Retired neighbours who like fixing things")).toBeVisible();

  // "Not now" changes nothing.
  await box.getByRole("button", { name: "Not now: Where" }).click();
  await expect(box).toHaveCount(0);
  await expect(fact(page, "Where").getByText("Hackney")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("section[aria-labelledby=suggestions-title]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /updates? for your idea/ })).toHaveCount(0);
});

test("Gusty's changes from steps show where they came from, and can be undone", async ({ page }) => {
  const id = await newProject(page);
  // As if a finished step had added who it's for, and answered "Who would this help most?".
  sql(`with f as (
         insert into public.project_facts (project_id, owner_id, kind, value, source, status, position)
         select id, owner_id, 'audience', 'Retired neighbours who fix radios', 'ai_from_user', 'proposed', 50
         from public.projects where id = '${id}' returning id, project_id, owner_id)
       insert into public.fact_suggestions (project_id, owner_id, kind, value, status, fact_id)
       select project_id, owner_id, 'audience', 'Retired neighbours who fix radios', 'applied', id from f`);
  sql(`insert into public.fact_suggestions (project_id, owner_id, kind, value, status, fact_id)
       select project_id, owner_id, 'question', 'Older people living alone nearby', 'applied', id
       from public.project_facts where project_id = '${id}' and value = 'Who would this help most?'`);
  await page.reload();

  await expect(page.getByRole("link", { name: "Your idea grew from your steps" })).toBeVisible();
  const audience = fact(page, "Who it's for");
  await expect(audience.getByText("Retired neighbours who fix radios")).toBeVisible();
  await expect(audience.getByText("Updated from one of your steps")).toBeVisible();

  // The answered question is folded away, with its answer.
  const questions = page.locator("section[aria-labelledby=open-questions]");
  await expect(questions.getByText("Who would this help most?")).toBeHidden();
  await questions.getByText("1 answered in your steps").click();
  await expect(questions.getByText("Older people living alone nearby")).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Undo takes Gusty's addition away; "Bring it back" reopens the question.
  await audience.getByRole("button", { name: "Undo: Retired neighbours who fix radios" }).click();
  await expect(page.getByText("Retired neighbours who fix radios")).toHaveCount(0);
  await questions.getByRole("button", { name: "Bring it back: Who would this help most?" }).click();
  await expect(questions.getByText("1 answered in your steps")).toHaveCount(0);
  await expect(questions.getByText("Who would this help most?")).toBeVisible();
});

test("editing an item Gusty changed makes it the person's, without the Undo", async ({ page }) => {
  const id = await newProject(page);
  sql(`with f as (
         update public.project_facts set value = 'A monthly repair café run by retired neighbours', source = 'ai_from_user'
         where project_id = '${id}' and kind = 'summary' returning id, project_id, owner_id)
       insert into public.fact_suggestions (project_id, owner_id, kind, value, status, fact_id, previous, previous_source)
       select project_id, owner_id, 'summary', 'A monthly repair café run by retired neighbours', 'applied', id,
              'A repair café in the old library.', 'ai_from_user' from f`);
  await page.reload();
  const summary = fact(page, "In one sentence");
  await expect(summary.getByText("Updated from one of your steps")).toBeVisible();
  await summary.getByRole("button", { name: /^Edit/ }).click();
  await summary.getByRole("button", { name: "Save" }).click();
  await expect(summary.getByText("Your words")).toBeVisible();
  await expect(summary.getByText("Updated from one of your steps")).toHaveCount(0);
  await expect(summary.getByText("A monthly repair café run by retired neighbours")).toBeVisible();
});

test("undo puts back what Gusty had before", async ({ page }) => {
  const id = await newProject(page);
  sql(`with f as (
         update public.project_facts set value = 'A monthly repair café', source = 'ai_from_user'
         where project_id = '${id}' and kind = 'summary' returning id, project_id, owner_id)
       insert into public.fact_suggestions (project_id, owner_id, kind, value, status, fact_id, previous, previous_source)
       select project_id, owner_id, 'summary', 'A monthly repair café', 'applied', id,
              'A repair café in the old library.', 'ai_from_user' from f`);
  await page.reload();
  const summary = fact(page, "In one sentence");
  await summary.getByRole("button", { name: "Undo: A monthly repair café" }).click();
  await expect(summary.getByText("A repair café in the old library.")).toBeVisible();
  await expect(summary.getByText("Updated from one of your steps")).toHaveCount(0);
});

test("the Story tab (old Notes links still work) says what it's for", async ({ page }) => {
  const id = await newProject(page);
  await page.goto(`/en/projects/${id}?tab=notes`);
  await expect(page.getByText("Everything about your project in one place", { exact: false })).toBeVisible();
});
