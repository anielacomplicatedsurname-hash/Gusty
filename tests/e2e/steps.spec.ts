import { execFileSync } from "node:child_process";
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

const sql = (query: string) =>
  execFileSync("docker", ["exec", "supabase_db_gusty", "psql", "-U", "postgres", "-d", "postgres", "-qc", query]);

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

  await mode(page, "Show me the whole journey").click();
  await expect(page.locator("ol[aria-label='Your next steps'] > li")).toHaveCount(3);
});

test("ticking a step off keeps it, and progress survives a reload", async ({ page }) => {
  await projectWithSteps(page);
  await page.getByLabel("Done: Write your idea in three sentences").check();
  await expect(page.getByText("1 done so far")).toBeVisible();
  await expect(page.getByText("Start here", { exact: true })).toBeVisible();
  await expect(stepTitle(page, "List three people you could tell about it")).toBeVisible();
  // The next step starts unticked: a tick never carries over (tester report, 2026-10-28).
  await expect(page.getByLabel("Done: List three people you could tell about it")).not.toBeChecked();

  await page.reload();
  await expect(page.getByText("1 done so far")).toBeVisible();
  await mode(page, "Show me the whole journey").click();
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
  await mode(page, "Show me the whole journey").click();
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

test("working on a step with Gusty: questions, rewording, answers, notes, done", async ({ page }) => {
  await projectWithSteps(page);
  const projectUrl = page.url();
  await page.getByRole("link", { name: "Work on this with Gusty: Write your idea in three sentences" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}\/steps\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Write your idea in three sentences" })).toBeVisible();

  // Up to three questions, labelled as demo examples here (no AI key in tests).
  await expect(page.getByText("Demo mode: these are general example questions")).toBeVisible();
  const questions = page.locator("section[aria-labelledby=questions-title] ol > li");
  await expect(questions).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "What would \"done\" look like for this step?" })).toBeVisible();

  // "Say it differently" rewords one question.
  await questions.first().getByRole("button", { name: "Say it differently" }).click();
  await expect(page.getByRole("heading", { name: "How will you know this step is finished?" })).toBeVisible();

  // Answers and notes save themselves and survive a reload.
  const firstAnswer = questions.first().getByLabel("Your answer");
  await firstAnswer.fill("Three sentences in my notes");
  await firstAnswer.blur();
  await expect(questions.first().locator("[data-status=saved]")).toBeVisible();
  const notes = page.locator("textarea#notes");
  await notes.fill("A place where neighbours fix things together.");
  await notes.blur();
  await expect(page.locator("#notes-status[data-status=saved]")).toBeVisible();
  await page.reload();
  await expect(questions.first().getByLabel("Your answer")).toHaveValue("Three sentences in my notes");
  await expect(page.locator("textarea#notes")).toHaveValue("A place where neighbours fix things together.");

  // "Different questions" swaps only the unanswered ones; the answer stays.
  const before = await questions.nth(1).getByRole("heading").textContent();
  await page.getByRole("button", { name: "Different questions" }).click();
  await expect(questions.nth(1).getByRole("heading")).not.toHaveText(before!);
  await expect(questions.first().getByLabel("Your answer")).toHaveValue("Three sentences in my notes");

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Done: back to the project, step ticked off.
  await page.getByRole("button", { name: "This step is done" }).click();
  await expect(page).toHaveURL(projectUrl);
  await expect(page.getByText("1 done so far")).toBeVisible();

  // The answers are kept on the project page, folded up until opened.
  const worked = page.locator("section[aria-labelledby=worked-title]");
  await expect(worked.getByRole("heading", { name: "What you've worked out" })).toBeVisible();
  await expect(worked.getByText("Done · 1 answer · notes")).toBeVisible();
  await expect(worked.getByText("Three sentences in my notes")).toBeHidden();
  await worked.getByText("Write your idea in three sentences").click();
  await expect(worked.getByText("Three sentences in my notes")).toBeVisible();
  await expect(worked.getByText("A place where neighbours fix things together.")).toBeVisible();
  const projectScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(projectScan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await worked.getByRole("link", { name: "Edit your answers: Write your idea in three sentences" }).click();
  await expect(page.getByText("You've already ticked this step off.")).toBeVisible();

  // Done steps stay reachable from the full plan too.
  await page.goto(projectUrl);
  await mode(page, "Show me the whole journey").click();
  await page.locator("section[aria-labelledby=done-title]").getByRole("link", { name: "Write your idea in three sentences" }).click();
  await expect(page).toHaveURL(/\/steps\/[0-9a-f-]{36}$/);
  await expect(page.locator("textarea#notes")).toHaveValue("A place where neighbours fix things together.");
});

test("Help me say more suggests a longer answer the person can use or ignore; tidied words keep the original", async ({ page }) => {
  await projectWithSteps(page);
  const projectUrl = page.url();
  await page.getByRole("link", { name: "Work on this with Gusty: Write your idea in three sentences" }).click();
  const questions = page.locator("section[aria-labelledby=questions-title] ol > li");
  await expect(questions).toHaveCount(3);
  const first = questions.first();

  // Only offered once there's something to build on.
  await expect(first.getByRole("button", { name: "Help me say more" })).toHaveCount(0);
  const answer = first.getByLabel("Your answer");
  await answer.fill("a cafe were people fix stuff");
  await answer.blur();
  await expect(first.locator("[data-status=saved]")).toBeVisible();

  // "Keep mine" leaves the answer alone.
  await first.getByRole("button", { name: "Help me say more" }).click();
  await expect(first.getByRole("heading", { name: "Gusty's suggestion" })).toBeVisible();
  await expect(first.getByText("Demo mode: Gusty's own ideas appear here")).toBeVisible();
  // About three times what they wrote (6 words → at most 18), so it's easy to read at once.
  const suggested = await first.locator("section p.whitespace-pre-line").textContent();
  expect(suggested!.trim().split(/\s+/).length).toBeLessThanOrEqual(18);
  await first.getByRole("button", { name: "Keep mine" }).click();
  await expect(first.getByRole("heading", { name: "Gusty's suggestion" })).toHaveCount(0);
  await expect(answer).toHaveValue("a cafe were people fix stuff");

  // "Use this" puts it in the box, still editable, and labels Gusty's help.
  await first.getByRole("button", { name: "Help me say more" }).click();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await first.getByRole("button", { name: "Use this" }).click();
  await expect(answer).toHaveValue(/^a cafe were people fix stuff\n\nMaybe I could also think about/);
  await expect(answer).toBeFocused();
  await expect(first.getByText("Gusty added ideas to this answer.")).toBeVisible();
  await page.reload();
  await expect(questions.first().getByLabel("Your answer")).toHaveValue(/Maybe I could also think about/);
  await expect(questions.first().getByText("Gusty added ideas to this answer.")).toBeVisible();

  // Without an AI key nothing is tidied, so the test stands in for Gusty here.
  await questions.first().getByLabel("Your answer").fill("a cafe were people fix stuff");
  await questions.first().getByLabel("Your answer").blur();
  await expect(questions.first().locator("[data-status=saved]")).toBeVisible();
  sql(`update public.step_questions set answer_tidied = 'A café where people fix things.' where answer = 'a cafe were people fix stuff'`);
  await page.goto(projectUrl);
  const worked = page.locator("section[aria-labelledby=worked-title]");
  await worked.getByText("Write your idea in three sentences").click();
  await expect(worked.getByText("A café where people fix things.")).toBeVisible();
  await expect(worked.getByText("Gusty added ideas", { exact: true })).toBeVisible();
  await expect(worked.getByText("a cafe were people fix stuff")).toBeHidden();
  await worked.getByText("Show what I wrote").click();
  await expect(worked.getByText("a cafe were people fix stuff")).toBeVisible();
  const projectScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(projectScan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("the plan grows one stage at a time, with a calm moment when a stage is done", async ({ page }) => {
  await projectWithSteps(page);
  await expect(page.getByText("Stage 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Getting clear on the idea")).toBeVisible();

  for (const title of ["Write your idea in three sentences", "List three people you could tell about it", "Choose one small thing to try this week"]) {
    await page.getByLabel(`Done: ${title}`).check();
    await expect(page.getByLabel(`Done: ${title}`)).toHaveCount(0);
  }

  // At most three choices, and no pressure.
  const finished = page.locator("section[aria-labelledby=finished-title]");
  await expect(finished.getByRole("heading", { name: "You finished this stage" })).toBeVisible();
  await expect(finished.getByRole("button")).toHaveCount(2);
  await expect(finished.locator("summary")).toHaveText("Look back at this stage");
  await finished.getByText("Look back at this stage").click();
  await expect(finished.getByRole("link", { name: "Write your idea in three sentences" })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await finished.getByRole("button", { name: "Take a break" }).click();
  await expect(finished.getByText("nothing here has a deadline")).toBeVisible();

  // Still there after a reload; then Gusty plans the next stage only.
  await page.reload();
  await page.locator("section[aria-labelledby=finished-title]").getByRole("button", { name: "Plan the next stage" }).click();
  await expect(page.getByText("Stage 2", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Sharing it with a few people")).toBeVisible();
  await expect(stepTitle(page, "Pick one person to tell about your idea")).toBeVisible();
  await expect(page.getByText("3 done so far")).toBeVisible();

  // The whole journey: where you've been, what's now, and loose ideas for later.
  await mode(page, "Show me the whole journey").click();
  const past = page.locator("section[aria-labelledby=past-title]");
  await expect(past.getByText("Stage 1: Getting clear on the idea")).toBeVisible();
  await past.getByText("Stage 1: Getting clear on the idea").click();
  await expect(past.getByRole("link", { name: "List three people you could tell about it" })).toBeVisible();
  const later = page.locator("section[aria-labelledby=later-title]");
  await expect(later.getByText("Not a plan: they'll change as your idea grows.")).toBeVisible();
  await expect(later.getByText("Example: plan a first small try")).toBeVisible();
  const journeyScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(journeyScan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("Help me summarise it sums up the answers, and a kept summary stays the person's to change", async ({ page }) => {
  await projectWithSteps(page);
  const projectUrl = page.url();
  await page.getByRole("link", { name: "Work on this with Gusty: Write your idea in three sentences" }).click();
  const write = page.locator("section[aria-labelledby=write-title]");
  await expect(page.locator("section[aria-labelledby=questions-title] ol > li")).toHaveCount(3);

  // Nothing to summarise yet.
  await write.getByRole("button", { name: "Help me summarise it" }).click();
  await expect(write.getByText("Answer a question or add a note first")).toBeVisible();

  const answer = page.locator("section[aria-labelledby=questions-title] ol > li").first().getByLabel("Your answer");
  await answer.fill("A café where neighbours fix things together");
  await answer.blur();
  await expect(page.locator("[data-status=saved]").first()).toBeVisible();

  await write.getByRole("button", { name: "Help me summarise it" }).click();
  const draft = write.locator("section[aria-labelledby=draft-suggestion]");
  await expect(draft.getByRole("heading", { name: "Gusty's summary" })).toBeVisible();
  await expect(draft.getByText("Demo mode: this only puts your own answers together.")).toBeVisible();
  await expect(draft.getByText("A café where neighbours fix things together")).toBeVisible();
  await draft.getByRole("button", { name: "Shorter" }).click();
  await expect(draft.getByRole("button", { name: "Shorter" })).toBeEnabled();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Keeping it makes it an editable summary, marked as started by Gusty.
  await draft.getByRole("button", { name: "Keep this summary" }).click();
  const yours = write.getByLabel("Your summary");
  await expect(yours).toHaveValue("A café where neighbours fix things together");
  await expect(write.getByText("Started by Gusty, kept by you.")).toBeVisible();
  await yours.fill("A café where neighbours fix things together, every Saturday.");
  await yours.blur();
  await expect(write.locator("#draft-status[data-status=saved]")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your summary")).toHaveValue("A café where neighbours fix things together, every Saturday.");

  await page.goto(projectUrl);
  const worked = page.locator("section[aria-labelledby=worked-title]");
  await worked.getByText("Write your idea in three sentences").click();
  await expect(worked.getByRole("heading", { name: "Summary (started by Gusty)" })).toBeVisible();
  await expect(worked.getByText("every Saturday.")).toBeVisible();
});
