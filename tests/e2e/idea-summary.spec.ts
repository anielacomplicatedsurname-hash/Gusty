import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

test("your idea, as it stands: a summary of what's been said, with the person's own words kept underneath", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel("What's your idea?").fill("cycling club");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);

  // After Gusty's first reading, the summary writes itself.
  const section = page.locator("section[aria-labelledby=summary-title]");
  await expect(section.getByRole("heading", { name: "Your idea, as it stands" })).toBeVisible();
  await expect(section.getByText(/Gusty's summary of everything you've said · updated/)).toBeVisible({ timeout: 20_000 });
  await expect(section.getByText("Demo mode: this just puts your own words side by side.")).toBeVisible();

  // The person's own words are folded underneath, never changed, and still editable.
  const original = section.locator("details", { hasText: "Your original words" });
  await expect(original).not.toHaveAttribute("open", "");
  await original.getByText("Your original words").click();
  const idea = original.getByRole("textbox");
  await expect(idea).toHaveValue("cycling club");
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Adding more makes the summary offer to catch up, only when asked.
  await idea.fill("A cycling club for older women in Leeds who haven't ridden since childhood.");
  await expect(section.locator("#project-idea-status[data-status=saved]")).toBeVisible();
  await page.reload();
  await expect(section.getByText("You've added more since this summary.")).toBeVisible();
  await section.getByRole("button", { name: "Refresh the summary" }).click();
  await expect(section.getByText("You've added more since this summary.")).toHaveCount(0);
});
