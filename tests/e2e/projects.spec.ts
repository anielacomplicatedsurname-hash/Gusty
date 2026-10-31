import AxeBuilder from "@axe-core/playwright";
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

  // Once Gusty's summary is written, the person's own words are folded underneath it.
  await expect(page.getByText(/Gusty's summary of everything you've said · updated/)).toBeVisible({ timeout: 20_000 });
  await page.getByText("Your original words").click();
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
  const search = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
  expect(search.messages[0].Subject).toBe("Keep your Gusty projects");
  await page.goto(link!);

  await expect(page).toHaveURL(/\/en\/projects$/);
  await expect(page.getByRole("link", { name: `Signed in as ${email}` })).toBeVisible();
  await expect(page.getByRole("link", { name: /Repair café in the old library/ })).toBeVisible();

  // Who is signed in shows on every page, not only My Projects.
  await page.goto("/en");
  await expect(page.getByRole("link", { name: `Signed in as ${email}. Go to your account` })).toBeVisible();
});

test("guests don't see a signed-in badge", async ({ page }) => {
  await createProject(page, "An idea from a guest");
  await page.goto("/en");
  await expect(page.getByRole("link", { name: /Signed in as/ })).toHaveCount(0);
});

test("a guest whose email already has an account can bring their projects into it", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one email round-trip is enough");
  const email = `returning-${Date.now()}@example.com`;

  // Someone already has an account with this email (made in another browser).
  const laptop = await browser.newContext();
  const other = await laptop.newPage();
  await createProject(other, "My first project, from my laptop");
  await other.goto("/en/projects");
  await other.getByLabel("Email address").fill(email);
  await other.getByRole("button", { name: "Send me a link" }).click();
  await expect(other.getByRole("status").filter({ hasText: "Check your inbox" })).toBeVisible();
  await other.goto((await waitForLink(email, 1))!);
  await expect(other.getByRole("link", { name: `Signed in as ${email}` })).toBeVisible();
  await laptop.close();

  // On a new device they start as a guest, then use the same email.
  await createProject(page, "A second idea, from my phone");
  await page.goto("/en/projects");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByText("Welcome back to Gusty!")).toBeVisible();
  await expect(page.getByText("Want to bring your current projects with you?")).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations).toEqual([]);

  // "Use a different email" clears the box and hides the choice.
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByText("Welcome back to Gusty!")).toHaveCount(0);

  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await page.getByRole("button", { name: "Sign in and keep my projects" }).click();
  await expect(page.getByRole("status").filter({ hasText: "your projects will come with you" })).toBeVisible();

  await page.goto((await waitForLink(email, 2))!);
  await expect(page).toHaveURL(/\/en\/projects$/);
  await expect(page.getByRole("link", { name: `Signed in as ${email}` })).toBeVisible();
  await expect(page.getByRole("link", { name: /A second idea, from my phone/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /My first project, from my laptop/ })).toBeVisible();
});

/** Waits until the inbox holds `count` emails for this address, then returns the newest link. */
async function waitForLink(email: string, count: number): Promise<string | null> {
  await expect
    .poll(async () => {
      const search = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
      return search.messages?.length ?? 0;
    }, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(count);
  return latestLinkFor(email);
}

test("a guest can keep their projects by typing the code from the email", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one email round-trip is enough");
  const email = `code-${Date.now()}@example.com`;
  await createProject(page, "Community fridge by the station");
  await page.goto("/en/projects");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();

  await page.getByLabel("Or type the code from the email").fill("000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That code didn't work" })).toBeVisible();

  await page.getByLabel("Or type the code from the email").fill((await waitForCode(email))!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/projects$/);
  await expect(page.getByRole("link", { name: `Signed in as ${email}` })).toBeVisible();
  await expect(page.getByRole("link", { name: /Community fridge by the station/ })).toBeVisible();
});

test("a returning person can bring guest projects by typing the code", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one email round-trip is enough");
  const email = `code-returning-${Date.now()}@example.com`;
  const laptop = await browser.newContext();
  const other = await laptop.newPage();
  await createProject(other, "Laptop project");
  await other.goto("/en/projects");
  await other.getByLabel("Email address").fill(email);
  await other.getByRole("button", { name: "Send me a link" }).click();
  await other.getByLabel("Or type the code from the email").fill((await waitForCode(email))!);
  await other.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(other.getByRole("link", { name: `Signed in as ${email}` })).toBeVisible();
  await laptop.close();

  await createProject(page, "Phone project");
  // Work on a step as a guest, so the answer has to come along too.
  const phoneProject = page.url();
  await page.getByRole("link", { name: "See directions" }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: "Show me where I could go next" }).click();
  await page.getByRole("button", { name: "Choose this: Shape the idea" }).click();
  await page.getByRole("link", { name: "Work on this with Gusty: Write your idea in three sentences" }).click();
  const answer = page.locator("section[aria-labelledby=questions-title] ol > li").first().getByLabel("Your answer");
  await answer.fill("An answer written as a guest");
  await answer.blur();
  await expect(page.locator("[data-status=saved]").first()).toBeVisible();
  await page.goto("/en/projects");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await page.getByRole("button", { name: "Sign in and keep my projects" }).click();
  await expect(page.getByRole("status").filter({ hasText: "your projects will come with you" })).toBeVisible();
  await page.getByLabel("Or type the code from the email").fill((await waitForCode(email, 2))!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("link", { name: `Signed in as ${email}` })).toBeVisible();
  await expect(page.getByRole("link", { name: /Phone project/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Laptop project/ })).toBeVisible();
  await page.goto(`${phoneProject}?tab=plan`);
  const worked = page.locator("section[aria-labelledby=worked-title]");
  await worked.getByText("Write your idea in three sentences").click();
  await expect(worked.getByText("An answer written as a guest")).toBeVisible();
});

/** Waits for the `count`-th email to this address and returns the sign-in code in it. */
async function waitForCode(email: string, count = 1): Promise<string | null> {
  await waitForLink(email, count);
  const search = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
  const message = await (await fetch(`${mailpit}/api/v1/message/${search.messages[0].ID}`)).json();
  return (message.HTML as string).match(/>\s*(\d{6,10})\s*</)?.[1] ?? null;
}

async function latestLinkFor(email: string): Promise<string | null> {
  const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const { messages } = (await search.json()) as { messages: { ID: string }[] };
  if (!messages?.length) return null;
  const message = await (await fetch(`${mailpit}/api/v1/message/${messages[0].ID}`)).json();
  const match = (message.HTML as string).match(/href="([^"]+)"/);
  return match ? match[1].replaceAll("&amp;", "&") : null;
}
