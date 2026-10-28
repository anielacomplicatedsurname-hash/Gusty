import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const axe = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

test("the privacy notice and terms are reachable from every page and readable", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeVisible();
  await expect(page.getByText("Aniela Fidler-Wieruszewska, a sole trader").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "ico.org.uk" })).toHaveAttribute("href", "https://ico.org.uk");
  expect((await axe(page)).violations).toEqual([]);

  await expect(page.getByText("we never use one person's ideas to make suggestions for someone else").first()).toBeVisible();

  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your ideas stay private" })).toBeVisible();
  await expect(page.getByText("We can't be responsible for other people having, developing or launching ideas similar to yours.", { exact: false })).toBeVisible();
  await expect(page.getByText("within 14 days of a payment for a full refund")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});

test.describe("feedback", () => {
  test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");

  test("anyone can send feedback, and only the admin reads it", async ({ page }) => {
    const note = `The steps felt kind ${Date.now()}`;
    await page.goto("/en/support");
    await page.locator("footer").getByRole("link", { name: "Tell us what you think" }).click();
    await expect(page).toHaveURL(/\/en\/feedback\?from=%2Fen%2Fsupport$/);
    expect((await axe(page)).violations).toEqual([]);

    await page.getByRole("button", { name: "Send my thoughts" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Write a few words" })).toBeVisible();

    await page.getByLabel("What worked well?").fill(note);
    await page.getByRole("button", { name: "Send my thoughts" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Thank you" })).toBeVisible();

    // Sending made a guest session; turn it into an admin to read the feedback back.
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name.startsWith("sb-"))).toBe(true);
    const sql = (q: string) => execFileSync("docker", ["exec", "supabase_db_gusty", "psql", "-U", "postgres", "-d", "postgres", "-Atc", q]).toString().trim();
    const owner = sql(`select owner_id from public.feedback where worked = '${note}'`);
    expect(owner).not.toBe("");
    expect(sql(`select page from public.feedback where worked = '${note}'`)).toBe("/en/support");
    sql(`insert into public.admins (user_id) values ('${owner}') on conflict do nothing`);
    try {
      await page.goto("/en/admin");
      await expect(page.getByRole("heading", { name: "Feedback from testers" })).toBeVisible();
      await expect(page.getByText(note)).toBeVisible();
    } finally {
      sql(`delete from public.admins where user_id = '${owner}'`);
    }
  });
});

test("every page invites feedback without getting in the way", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByText("Gusty is in early testing.")).toBeVisible();
  await page.getByText("Gusty is in early testing.").getByRole("link", { name: "Tell us what you think" }).click();
  await expect(page).toHaveURL(/\/en\/feedback\?from=%2Fen$/);
});

test.describe("feedback on a project", () => {
  test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
  test("the project page ends with an invitation to share thoughts", async ({ page }) => {
    await page.goto("/en");
    await page.getByLabel("What's your idea?").fill("A tool library for the street");
    await page.getByRole("button", { name: "Start with my idea" }).click();
    await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "How is Gusty working for you?" })).toBeVisible();
    await page.locator("section[aria-labelledby=feedback-card-title]").getByRole("link", { name: "Tell us what you think" }).click();
    await expect(page).toHaveURL(/\/en\/feedback\?from=%2Fen%2Fprojects%2F[0-9a-f-]{36}$/);
  });
});
