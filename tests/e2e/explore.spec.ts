import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Needs the local Supabase: opportunities are added directly in the database, or by an admin.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "viewport-independent");
});

const sql = (query: string) =>
  execFileSync("docker", ["exec", "supabase_db_gusty", "psql", "-U", "postgres", "-d", "postgres", "-qtAc", query]).toString().trim();

test("Explore shows checked, published funding with its source, and only what's still open", async ({ page }) => {
  const run = Date.now();
  const add = (title: string, status: string, deadline: string, regions: string) =>
    sql(`insert into public.opportunities (title, funder, url, summary, who_for, amount, deadline, regions, status, checked_at)
         values ('${title}', 'Example Trust', 'https://www.example.org/fund', 'Small grants for community arts.',
                 'Groups and individuals', 'Up to £2,000', ${deadline}, '{${regions}}', '${status}', '2026-10-20')`);
  add(`Open UK fund ${run}`, "published", "current_date + 30", "uk");
  add(`Open Europe fund ${run}`, "published", "null", "europe");
  add(`Draft fund ${run}`, "draft", "null", "uk");
  add(`Closed fund ${run}`, "published", "current_date - 1", "uk");

  // The full list: earlier test runs may have added more than the first few shown.
  await page.goto("/en/explore?more=1");
  await expect(page.getByRole("heading", { level: 1, name: "Explore" })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  const uk = page.getByRole("article", { name: `Open UK fund ${run}` });
  await expect(uk).toBeVisible();
  await expect(uk.getByText("Up to £2,000")).toBeVisible();
  await expect(uk.getByText(/^Closes /)).toBeVisible();
  await expect(uk.getByText("Checked by the Gusty team on 20 October 2026")).toBeVisible();
  await expect(uk.getByRole("link", { name: /See the funder's page/ })).toHaveAttribute("href", "https://www.example.org/fund");
  await expect(page.getByText(`Draft fund ${run}`)).toHaveCount(0);
  await expect(page.getByText(`Closed fund ${run}`)).toHaveCount(0);

  // Filtering by area.
  await page.getByRole("navigation", { name: "Where" }).getByRole("link", { name: "Europe" }).click();
  await expect(page).toHaveURL(/region=europe/);
  await page.goto("/en/explore?region=europe&more=1");
  await expect(page.getByRole("article", { name: `Open Europe fund ${run}` })).toBeVisible();
  await expect(page.getByRole("article", { name: `Open UK fund ${run}` })).toHaveCount(0);

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("the founder adds, publishes and takes down an opportunity", async ({ page }) => {
  const run = Date.now();
  await page.goto("/en/admin/opportunities");
  await expect(page.getByRole("heading", { name: "This page wandered off." })).toBeVisible();

  // Become an admin (a guest account is created by starting a project).
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("An idea so I have an account");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop();
  sql(`insert into public.admins (user_id) select owner_id from public.projects where id = '${id}' on conflict do nothing`);
  try {
    await page.goto("/en/admin");
    await page.getByRole("link", { name: "Manage opportunities" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Opportunities" })).toBeVisible();

    // Without an AI key Gusty says so, and the founder can fill it in by hand.
    await page.getByLabel("Link to the funder's page").fill("https://www.example.org/new-fund");
    await page.getByRole("button", { name: "Let Gusty fill it in" }).click();
    await expect(page.getByText("Gusty can't read pages without the AI key.")).toBeVisible();
    await page.getByRole("button", { name: "Fill it in myself" }).click();
    await page.getByLabel("Name of the opportunity").fill(`Founder fund ${run}`);
    await page.getByLabel("Funder", { exact: true }).fill("Example Foundation");
    await page.getByLabel("UK", { exact: true }).check();
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    await page.getByRole("button", { name: "I've checked it: publish" }).click();
    await expect(page.getByText("Published. It's on Explore now")).toBeVisible();

    await page.goto("/en/explore?more=1");
    await expect(page.getByRole("article", { name: `Founder fund ${run}` })).toBeVisible();

    await page.goto("/en/admin/opportunities");
    await page.getByRole("button", { name: `Take down: Founder fund ${run}` }).click();
    await expect(page.getByRole("button", { name: `Publish again: Founder fund ${run}` })).toBeVisible();
    await page.goto("/en/explore?more=1");
    await expect(page.getByText(`Founder fund ${run}`)).toHaveCount(0);
  } finally {
    sql(`delete from public.admins where user_id = (select owner_id from public.projects where id = '${id}')`);
  }
});
