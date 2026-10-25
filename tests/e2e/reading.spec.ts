import { expect, test, type Page } from "@playwright/test";

// Runs in demo mode (no AI key in tests), which exercises the whole flow except the model call.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

async function newProject(page: Page) {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("A repair café in the old library. Volunteers fix things.");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
  await expect(page.getByTestId("demo-notice")).toBeVisible({ timeout: 15_000 });
}

const section = (page: Page, name: string) =>
  page.locator("dl > div").filter({ has: page.getByText(name, { exact: true }) });

test("Gusty's first reading appears automatically and is labelled honestly", async ({ page }) => {
  await newProject(page);
  const summary = section(page, "In one sentence");
  await expect(summary.getByText("A repair café in the old library.")).toBeVisible();
  await expect(summary.getByText("From your words")).toBeVisible();
  await expect(section(page, "Where").getByText("Not mentioned yet")).toBeVisible();
  await expect(page.getByText("Who would this help most?")).toBeVisible();
});

test("people can confirm, edit, add and remove, and it all persists", async ({ page }) => {
  await newProject(page);

  await section(page, "In one sentence").getByRole("button", { name: /^That's right/ }).click();
  await expect(section(page, "In one sentence").getByText("Confirmed")).toBeVisible();

  const stage = section(page, "Where you are now");
  await stage.getByRole("button", { name: /^Edit/ }).click();
  await stage.getByLabel("Where you are now").selectOption("planning");
  await stage.getByRole("button", { name: "Save" }).click();
  await expect(stage.getByText("Planning")).toBeVisible();
  await expect(stage.getByText("Your words")).toBeVisible();

  const audience = section(page, "Who it's for");
  await audience.getByRole("button", { name: /Add/ }).click();
  await audience.getByLabel("Who it's for").fill("Neighbours with broken lamps");
  await audience.getByRole("button", { name: "Save" }).click();
  await expect(audience.getByText("Neighbours with broken lamps")).toBeVisible();

  await page.getByRole("button", { name: "Remove: Who would this help most?" }).click();
  await expect(page.getByText("Who would this help most?")).toHaveCount(0);

  await page.reload();
  await expect(section(page, "In one sentence").getByText("Confirmed")).toBeVisible();
  await expect(section(page, "Where you are now").getByText("Planning")).toBeVisible();
  await expect(section(page, "Who it's for").getByText("Neighbours with broken lamps")).toBeVisible();
});

test("reading again keeps the person's own words and confirmed items", async ({ page }) => {
  await newProject(page);
  const stage = section(page, "Where you are now");
  await stage.getByRole("button", { name: /^Edit/ }).click();
  await stage.getByLabel("Where you are now").selectOption("started");
  await stage.getByRole("button", { name: "Save" }).click();
  await expect(stage.getByText("Started")).toBeVisible();

  await page.getByRole("button", { name: "Read my idea again" }).click();
  await expect(page.getByRole("button", { name: "Read my idea again" })).toBeEnabled();
  await page.reload();
  await expect(section(page, "Where you are now").getByText("Started")).toBeVisible();
  await expect(section(page, "Where you are now").getByText("Just an idea")).toHaveCount(0);
});

test("people can rename a project, and the new title shows in My Projects", async ({ page }) => {
  await newProject(page);
  await page.getByRole("button", { name: /^Rename/ }).click();
  await page.getByLabel("Project title").fill("Saturday Repair Café");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Saturday Repair Café" })).toBeVisible();
  await expect(page.getByText("Title suggested by Gusty")).toHaveCount(0);

  // Reading again never touches a title the person chose.
  await page.getByRole("button", { name: "Read my idea again" }).click();
  await expect(page.getByRole("button", { name: "Read my idea again" })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Saturday Repair Café" })).toBeVisible();

  await page.goto("/en/projects");
  await expect(page.getByRole("link", { name: /Saturday Repair Café/ })).toBeVisible();
});
