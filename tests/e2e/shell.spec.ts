import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the root redirects to the default locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("home shows the brand headline and the idea box", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/good ideas deserve to move/i);
  await expect(page.getByLabel("What's your idea?")).toBeVisible();
  // Without a database the button must not pretend to work.
  const button = page.getByRole("button", { name: /start with my idea/i });
  if (process.env.E2E_SUPABASE) await expect(button).toBeEnabled();
  else await expect(button).toBeDisabled();
});

test("navigation: bottom bar on mobile, header nav from tablet up", async ({ page }, testInfo) => {
  await page.goto("/en");
  const bottom = page.getByTestId("bottom-nav");
  const header = page.locator("header nav");
  if (testInfo.project.name === "mobile") {
    await expect(bottom).toBeVisible();
    await expect(header).toBeHidden();
  } else {
    await expect(bottom).toBeHidden();
    await expect(header).toBeVisible();
  }
});

test("the three destinations open, with unbuilt ones marked honestly", async ({ page }) => {
  await page.goto("/en");
  const nav = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
  for (const [label, path, placeholder] of [
    ["Explore", "explore", false],
    ["My Projects", "projects", false],
    ["Connections", "connections", true],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`/en/${path}$`));
    // Next keeps previously visited pages mounted but hidden, so only count visible text.
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    await expect(page.getByText("Coming next").filter({ visible: true })).toHaveCount(placeholder ? 1 : 0);
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
});

test("bottom bar never covers the last content on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/en");
  // Parts of the footer stream in; measure once the page has settled.
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("End");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const footerText = page.getByText("People, ideas, places for a brighter tomorrow.");
  const navBox = await page.getByTestId("bottom-nav").boundingBox();
  const textBox = await footerText.boundingBox();
  expect(textBox!.y + textBox!.height).toBeLessThanOrEqual(navBox!.y);
});

test("keyboard users can skip to the main content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile");
  await page.goto("/en");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
});

for (const path of ["/en", "/en/explore"]) {
  test(`no detectable accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("Speak to an expert: a 1:1 with the founder, with the fee and a Calendly link", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("contentinfo").getByRole("link", { name: "Speak to an expert" }).click();
  await expect(page).toHaveURL(/\/en\/expert$/);
  await expect(page.getByRole("heading", { level: 1, name: "Talk it through with a person" })).toBeVisible();
  await expect(page.getByText("£37 an hour")).toBeVisible();
  const book = page.getByRole("link", { name: /^Book a call/ });
  await expect(book).toHaveAttribute("href", "https://calendly.com/anielacomplicatedsurname/30min");
  await expect(book).toHaveAttribute("target", "_blank");
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
