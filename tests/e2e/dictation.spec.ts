import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The browser's speech recognition is replaced by a stand-in that "hears" a fixed sentence, so the whole
// journey runs without a microphone.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "covered by phone and desktop");
});

async function fakeSpeech(page: Page, { heard = "a seed library in the old phone box", error = "" } = {}) {
  await page.addInitScript(({ heard, error }) => {
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (window as unknown as { heardLang: string }).heardLang = this.lang;
        setTimeout(() => {
          if (error) {
            this.onerror?.({ error });
            this.onend?.();
          } else this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: heard } }] });
        }, 50);
      }
      stop() {
        setTimeout(() => this.onend?.(), 10);
      }
    }
    // Newer Chromium has both names; Gusty prefers the unprefixed one.
    const w = window as unknown as { SpeechRecognition: unknown; webkitSpeechRecognition: unknown };
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  }, { heard, error });
}

test("dictating an idea: Gusty says who hears it first, then the words land in the box", async ({ page }) => {
  await fakeSpeech(page);
  await page.goto("/en");
  const box = page.getByLabel("What's your idea?");
  await box.fill("My idea:");

  await page.getByRole("button", { name: "Dictate" }).click();
  const consent = page.getByRole("group", { name: "Before you dictate" });
  await expect(consent).toContainText("Gusty never receives the recording");
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await consent.getByRole("button", { name: "Start dictating" }).click();
  const stop = page.getByRole("button", { name: "Stop dictating" });
  await expect(stop).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "Listening" })).toBeVisible();
  await expect(box).toHaveValue("My idea: a seed library in the old phone box");
  expect(await page.evaluate(() => (window as unknown as { heardLang: string }).heardLang)).toMatch(/^en/);

  await stop.click();
  await expect(page.getByRole("button", { name: "Dictate" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Start with my idea" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/);
  await expect(page.locator("#project-idea")).toHaveValue(/a seed library in the old phone box/);

  // Once agreed, the next time starts listening straight away.
  await page.goto("/en/feedback");
  await page.getByRole("button", { name: "Dictate" }).first().click();
  await expect(page.getByRole("group", { name: "Before you dictate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop dictating" })).toBeVisible();
  await expect(page.getByLabel("What worked well?")).toHaveValue("a seed library in the old phone box");
});

test("a blocked microphone is explained, and typing still works", async ({ page }) => {
  await fakeSpeech(page, { error: "not-allowed" });
  await page.goto("/en/feedback");
  await page.getByRole("button", { name: "Dictate" }).first().click();
  await page.getByRole("button", { name: "Start dictating" }).click();
  await expect(page.getByText("Gusty can't use your microphone.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dictate" }).first()).toBeEnabled();
});

test("browsers without speech recognition don't show the button", async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });
  await page.goto("/en");
  await expect(page.getByLabel("What's your idea?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dictate" })).toHaveCount(0);
});
