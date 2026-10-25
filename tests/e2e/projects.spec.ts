import { expect, test, type Page } from "@playwright/test";

// Needs a Supabase the app was built against (local `supabase start` in dev and CI).
const mailpit = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");

async function createProject(page: Page, idea: string) {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill(idea);
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
}

test("an idea is saved without an account and survives a reload", async ({ page }) => {
  await createProject(page, "A seed library for my street\nNeighbours swap seeds every spring.");
  await expect(page.getByRole("heading", { level: 1, name: "A seed library for my street" })).toBeVisible();

  const editor = page.getByLabel("Your idea", { exact: true });
  await editor.fill("A seed library for my street, with a monthly swap day.");
  await expect(page.locator("#project-idea-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });

  await page.reload();
  await expect(page.getByLabel("Your idea", { exact: true })).toHaveValue("A seed library for my street, with a monthly swap day.");

  await page.goto("/en/projects");
  await expect(page.getByRole("link", { name: /A seed library for my street/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keep your projects" })).toBeVisible();
});

test("an empty idea shows a helpful message instead of saving", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("   ");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Write a few words" })).toBeVisible();
  await expect(page).toHaveURL(/\/en$/);
});

test("projects are private to the person who made them", async ({ page, browser }) => {
  await createProject(page, "My private community radio idea");
  const url = page.url();

  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(url);
  await expect(strangerPage.getByText("We couldn't find that project.")).toBeVisible();
  await expect(strangerPage.getByText("My private community radio idea")).toHaveCount(0);
  await stranger.close();
});

test("a guest keeps their projects by confirming an email link", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one email round-trip is enough");
  const email = `guest-${Date.now()}@example.com`;
  await createProject(page, "Repair café in the old library");

  await page.goto("/en/projects");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check your inbox" })).toBeVisible();

  const link = await expect
    .poll(async () => latestLinkFor(email), { timeout: 15_000 })
    .not.toBeNull()
    .then(() => latestLinkFor(email));
  await page.goto(link!);

  await expect(page).toHaveURL(/\/en\/projects$/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByRole("link", { name: /Repair café in the old library/ })).toBeVisible();
});

async function latestLinkFor(email: string): Promise<string | null> {
  const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const { messages } = (await search.json()) as { messages: { ID: string }[] };
  if (!messages?.length) return null;
  const message = await (await fetch(`${mailpit}/api/v1/message/${messages[0].ID}`)).json();
  const match = (message.HTML as string).match(/href="([^"]+)"/);
  return match ? match[1].replaceAll("&amp;", "&") : null;
}
