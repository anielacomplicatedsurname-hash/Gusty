import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Needs the local Supabase (`supabase start`): admins can only be added directly in the database.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");

const sql = (query: string) =>
  execFileSync("docker", ["exec", "supabase_db_gusty", "psql", "-U", "postgres", "-d", "postgres", "-qc", query]);

async function createProject(page: Page, idea: string) {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill(idea);
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

test("the admin overview looks like a missing page to everyone else", async ({ page }) => {
  await page.goto("/en/admin");
  await expect(page.getByRole("heading", { name: "This page wandered off." })).toBeVisible();
  await createProject(page, "A choir for people who think they can't sing");
  await page.goto("/en/admin");
  await expect(page.getByRole("heading", { name: "This page wandered off." })).toBeVisible();
  await expect(page.getByText("Admin overview")).toHaveCount(0);
});

test("an admin sees counts and costs, never anyone's ideas", async ({ page }) => {
  const idea = "A secret garden plan only its owner should read";
  const id = await createProject(page, idea);
  sql(`insert into public.admins (user_id) select owner_id from public.projects where id = '${id}' on conflict do nothing`);
  try {
    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Admin overview" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    for (const section of ["People", "Projects", "Estimated AI cost", "AI use by day (last 14 days, UTC)"]) {
      await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByText(idea)).toHaveCount(0);
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(scan.violations).toEqual([]);
  } finally {
    sql(`delete from public.admins where user_id = (select owner_id from public.projects where id = '${id}')`);
  }
});
