import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// Demo mode (no AI key in tests): what Gusty "read" and the fit are clearly labelled made-up examples.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

const sql = (query: string) =>
  execFileSync("docker", ["exec", "supabase_db_gusty", "psql", "-U", "postgres", "-d", "postgres", "-qc", query]);

const pdf = {
  name: "Wellbeing Fund guidance.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n3 0 obj << /Type /Page >> endobj\n4 0 obj << /Type /Page >> endobj\n%%EOF"),
};

async function newProject(page: Page) {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("A cycling club for older women in Leeds.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("demo-notice")).toBeVisible({ timeout: 15_000 });
  return page.url().split("/").pop()!;
}

test("an application space: bring in the funder's papers, see what they want and how the project fits", async ({ page }) => {
  const id = await newProject(page);
  await page.goto(`/en/projects/${id}?tab=funding`);
  const list = page.locator("section[aria-labelledby=applications-title]");
  await list.getByRole("button", { name: "Start an application" }).click();
  await list.getByRole("button", { name: "Create the application space" }).isDisabled();
  await list.getByLabel("What are you applying for?").fill("Community Wellbeing Fund 2027");
  await list.getByLabel("Who runs it? (optional)").fill("Leeds Community Foundation");
  await list.getByRole("button", { name: "Create the application space" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/projects/${id}/apply/[0-9a-f-]{36}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Community Wellbeing Fund 2027" })).toBeVisible();
  // A new space opens on Papers, with one clear next thing to do.
  const views = page.getByRole("navigation", { name: "Application sections" });
  await expect(views.getByRole("link")).toHaveText(["Papers", "What they want", "Your fit", "Answers"]);
  await expect(views.getByRole("link", { name: "Papers" })).toHaveAttribute("aria-current", "page");

  // A private link can't be read; a bad one is refused straight away.
  const add = page.locator("section[aria-labelledby=add-title]");
  await add.getByRole("radio", { name: "Use a link" }).check();
  await expect(add.getByText(/If it needs a login .* download it as a PDF or paste the text instead/)).toBeVisible();
  await add.getByLabel("Link to a public page").fill("http://example.org/fund");
  await add.getByRole("button", { name: "Read this" }).click();
  await expect(add.getByRole("alert")).toHaveText(/That link doesn't look right/);

  // Paste the questions.
  await add.getByRole("radio", { name: "Paste the text" }).check();
  await add.getByLabel("Paste it here").fill("1. Tell us about your project. (300 words)\n2. What difference will it make?");
  await add.getByRole("button", { name: "Read this" }).click();
  await expect(page.getByText("Gusty has read it and kept what matters.")).toBeVisible({ timeout: 20_000 });
  // The form folds away once there's a paper.
  await expect(page.locator("section[aria-labelledby=papers-title] li")).toHaveCount(1);

  await page.getByRole("link", { name: "See what they're looking for" }).click();
  const brief = page.locator("section[aria-labelledby=brief-title]");
  await expect(brief.getByText("Demo mode: this is a made-up example, not what your paper says.")).toBeVisible();
  await expect(brief.getByText("Their questions are under Answers, ready to write.")).toBeVisible();
  await expect(brief.getByText("From: Pasted text").first()).toBeVisible();
  // Rules are grouped: who can apply, what you'll need, what they won't fund.
  await expect(brief.getByRole("heading", { name: "Who can apply" })).toBeVisible();
  await expect(brief.getByRole("heading", { name: "What they won't fund" })).toBeVisible();
  await expect(brief.getByText("Example: who can apply would be quoted here.")).toBeVisible();
  await brief.getByText("More from their papers").click();
  await expect(brief.getByText("Amount", { exact: true })).toBeVisible();
  let scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Gusty works out the fit in the background, then shows it; the longer parts are folded.
  await views.getByRole("link", { name: "Your fit" }).click();
  const fit = page.locator("section[aria-labelledby=fit-title]");
  await expect(fit.getByText("Demo mode: this is a made-up example. Gusty's real view appears once the AI key is set up.")).toBeVisible({ timeout: 20_000 });
  // A traffic light for the overall fit, in words as well as colour.
  await expect(fit.getByText("Partly fits", { exact: true })).toBeVisible();
  await expect(fit.getByText("Check these rules carefully")).toHaveCount(0);
  await expect(fit.getByRole("heading", { name: "What would make it stronger" })).toBeVisible();
  await expect(fit.getByText("Example: a rule from their papers your project may not meet.")).toBeVisible();
  await expect(fit.getByText("They say", { exact: true })).toBeHidden();
  await fit.getByText("Their words, your way").click();
  await expect(fit.getByText("They say", { exact: true })).toBeVisible();
  scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // A PDF too; the file isn't kept, only what was read.
  await views.getByRole("link", { name: "Papers" }).click();
  await page.getByRole("button", { name: "Add another paper" }).click();
  await add.getByRole("radio", { name: "Upload a PDF" }).check();
  await add.getByLabel("What is it?").selectOption("guidance");
  await add.getByLabel("Choose a PDF").setInputFiles(pdf);
  await add.getByRole("button", { name: "Read this" }).click();
  await expect(page.locator("section[aria-labelledby=papers-title] li")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.getByText("Wellbeing Fund guidance.pdf · 2 pages")).toBeVisible();

  // Removing a paper; the project list shows the space.
  await page.getByRole("button", { name: /^Remove: Pasted text/ }).click();
  await expect(page.locator("section[aria-labelledby=papers-title] li")).toHaveCount(1);
  await page.getByRole("link", { name: "Back to the project" }).click();
  await expect(list.getByRole("link", { name: /Community Wellbeing Fund 2027/ })).toContainText("Leeds Community Foundation · 1 paper read");

  // Deleting the space keeps the project.
  await list.getByRole("link", { name: /Community Wellbeing Fund 2027/ }).click();
  await page.getByRole("button", { name: "Delete this application space" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/projects/${id}\\?tab=funding$`));
  await expect(list.getByRole("link", { name: /Community Wellbeing Fund 2027/ })).toHaveCount(0);
});

test("a saved opportunity opens its own application space, once", async ({ page }) => {
  const id = await newProject(page);
  sql(`with s as (insert into public.opportunity_searches (project_id, owner_id, status)
         select id, owner_id, 'done' from public.projects where id = '${id}' returning id, project_id, owner_id)
       insert into public.found_opportunities (search_id, project_id, owner_id, rank, title, funder, url, scale, complexity, saved_at)
       select id, project_id, owner_id, 0, 'Example: Active Communities Grant', 'Example Trust', 'https://example.org/grant',
              'local', 'light', now() from s`);
  await page.goto(`/en/projects/${id}?tab=funding`);
  await page.getByRole("button", { name: "Prepare an application: Example: Active Communities Grant" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Example: Active Communities Grant" })).toBeVisible();
  await expect(page.locator("header").getByText(/^Example Trust/)).toBeVisible();
  const url = page.url();
  await page.goto(`/en/projects/${id}?tab=funding`);
  await page.getByRole("button", { name: "Prepare an application: Example: Active Communities Grant" }).click();
  await expect(page).toHaveURL(url);
});

test("drafting answers: Gusty drafts in the person's voice, leaves gaps in brackets, and the answer becomes theirs", async ({ page }) => {
  const id = await newProject(page);
  await page.goto(`/en/projects/${id}?tab=funding`);
  const list = page.locator("section[aria-labelledby=applications-title]");
  await list.getByRole("button", { name: "Start an application" }).click();
  await list.getByLabel("What are you applying for?").fill("Active Lives Fund");
  await list.getByRole("button", { name: "Create the application space" }).click();
  const answers = page.locator("section[aria-labelledby=answers-title]");
  const views = page.getByRole("navigation", { name: "Application sections" });
  await views.getByRole("link", { name: "Answers" }).click();
  await expect(answers.getByText("Bring in the application form or the questions to start writing answers.")).toBeVisible();
  await views.getByRole("link", { name: "Papers" }).click();

  const add = page.locator("section[aria-labelledby=add-title]");
  await add.getByRole("radio", { name: "Paste the text" }).check();
  await add.getByLabel("Paste it here").fill("1. Tell us about your project. (300 words)\n2. What difference will it make? (250 words)");
  await add.getByRole("button", { name: "Read this" }).click();
  await expect(page.getByText("Gusty has read it and kept what matters.")).toBeVisible({ timeout: 20_000 });

  // Once there are papers, the space opens on Answers, with the first unanswered question open.
  await page.goto(page.url().split("?")[0]);
  await expect(views.getByRole("link", { name: "Answers" })).toHaveAttribute("aria-current", "page");
  const first = answers.locator("ol > li").first();
  await expect(first.getByRole("button", { name: /Example: Tell us about your project and who it's for\./ })).toHaveAttribute("aria-expanded", "true");
  await expect(answers.locator("ol > li").nth(1).getByRole("button", { name: /Example: What difference/ })).toHaveAttribute("aria-expanded", "false");
  await expect(answers.locator("ol > li").nth(1).getByText("Not started · 250 words")).toBeVisible();
  await first.getByRole("button", { name: "Help me draft this" }).click();
  const box = first.getByLabel(/^Your answer to: /);
  // Drafts mirror the funder's language by default; their own words can be highlighted.
  await expect(box).toHaveValue(/\(Demo: Gusty's draft in the funder's language will go here/, { timeout: 20_000 });
  await first.getByRole("button", { name: "Show the funder's words" }).click();
  await expect(first.getByRole("button", { name: "Show the funder's words" })).toHaveAttribute("aria-pressed", "true");
  await expect(first.locator("mark", { hasText: "reducing loneliness" })).toBeVisible();
  await expect(first.getByText("Demo mode: this is a made-up example, not a real draft.")).toBeVisible();
  await expect(first.getByText("Fill in the parts in [brackets] before you send it.")).toBeVisible();
  await expect(first.getByText("Example: a number that shows the need")).toBeVisible();
  await expect(first.getByText(/^\d+ of 300 words$/)).toBeVisible();
  await expect(first.getByText("Gusty's draft, from your story. Change anything: it becomes yours.")).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // "Sound more like me" switches the next draft to the person's own voice.
  const voice = first.getByRole("switch", { name: "Sound more like me" });
  await expect(voice).toHaveAttribute("aria-checked", "false");
  await voice.click();
  await expect(voice).toHaveAttribute("aria-checked", "true");
  await first.getByRole("button", { name: "Draft it again" }).click();
  await expect(box).toHaveValue(/\(Demo: Gusty's draft of this answer will go here/, { timeout: 20_000 });

  // Editing makes it the person's.
  await box.fill("We started because nobody in our street had been on a bike for years. Twelve women came last summer.");
  await expect(first.getByText("Not saved yet")).toBeVisible();
  await first.getByRole("button", { name: "Save" }).click();
  await expect(first.getByRole("button", { name: "Saved" })).toBeDisabled();
  await expect(first.getByText("Your words", { exact: true })).toBeVisible();

  // Writing one from scratch.
  const second = answers.locator("ol > li").nth(1);
  await second.getByRole("button", { name: /Example: What difference/ }).click();
  await expect(first.getByLabel(/^Your answer to: /)).toBeHidden();
  await second.getByRole("button", { name: "Write it myself" }).click();
  await second.getByLabel(/^Your answer to: /).fill("Women who'd stopped going out will ride together every Saturday.");
  await second.getByRole("button", { name: "Save" }).click();
  await expect(second.getByRole("button", { name: "Saved" })).toBeDisabled();

  await page.reload();
  await expect(answers.locator("ol > li").first().getByLabel(/^Your answer to: /)).toHaveValue(/Twelve women came last summer\./);
  await expect(answers.locator("ol > li").first().getByText(/^Your words · \d+ of 300 words$/)).toBeVisible();
  const download = page.waitForEvent("download");
  await answers.getByRole("button", { name: "Download all my answers" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Active Lives Fund.txt");
  const { readFile } = await import("node:fs/promises");
  const text = await readFile((await file.path())!, "utf8");
  expect(text).toContain("Answers for: Active Lives Fund");
  expect(text).toContain("Twelve women came last summer.");
  expect(text).toContain("ride together every Saturday");
});
