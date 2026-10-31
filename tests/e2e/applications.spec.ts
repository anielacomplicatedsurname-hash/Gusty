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
  await expect(page.getByText("Bring in at least one of the funder's papers to see this.")).toBeVisible();

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
  await expect(add.getByText("Gusty has read it. What it found is below.")).toBeVisible({ timeout: 20_000 });

  const brief = page.locator("section[aria-labelledby=brief-title]");
  await expect(brief.getByText("Demo mode: this is a made-up example, not what your paper says.")).toBeVisible();
  await expect(brief.getByRole("heading", { name: "The questions" })).toBeVisible();
  await expect(brief.getByText("Limit: 300 words")).toBeVisible();
  await expect(brief.getByText("From: Pasted text").first()).toBeVisible();
  await expect(brief.getByText("Can apply", { exact: true })).toBeVisible();

  // Gusty works out the fit in the background, then shows it.
  const fit = page.locator("section[aria-labelledby=fit-title]");
  await expect(fit.getByText("Demo mode: this is a made-up example. Gusty's real view appears once the AI key is set up.")).toBeVisible({ timeout: 20_000 });
  await expect(fit.getByRole("heading", { name: "Their words, your way" })).toBeVisible();
  await expect(fit.getByText("Only the funder can say whether you're eligible.", { exact: false })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // A PDF too; the file isn't kept, only what was read.
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
