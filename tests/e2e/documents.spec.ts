import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Demo mode (no AI key in tests): Gusty says plainly it can't read the document yet, but the journey runs.
test.skip(!process.env.E2E_SUPABASE, "set E2E_SUPABASE=1 with a local Supabase running");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "viewport-independent");
});

const pdf = (pages = 2) => ({
  name: "Repair café plan.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4\n${Array.from({ length: pages }, (_, i) => `${i + 3} 0 obj << /Type /Page >> endobj`).join("\n")}\n%%EOF`),
});

test("bring in a new project from a PDF, then forget the document", async ({ page }) => {
  await page.goto("/en/projects");
  const card = page.locator("section[aria-labelledby=import-title]");
  await expect(card.getByRole("heading", { name: "Already working on something?" })).toBeVisible();
  await expect(card.getByText("Gusty keeps what it learns, not the file itself.")).toBeVisible();

  // Not a PDF.
  await card.getByLabel("Choose a PDF").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await card.getByRole("button", { name: "Bring it in" }).click();
  await expect(card.getByText("That doesn't look like a PDF.")).toBeVisible();

  await card.getByLabel("Choose a PDF").setInputFiles(pdf());
  await expect(card.getByRole("button", { name: "Bring it in" })).toBeEnabled();
  await card.getByRole("button", { name: "Bring it in" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Repair café plan");

  await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Story" }).click();
  const docs = page.locator("section[aria-labelledby=documents-title]");
  await docs.getByText("Repair café plan.pdf").click();
  await expect(docs.getByText("Gusty's notes from your document, not checked.")).toBeVisible();
  await expect(docs.getByText(/Demo mode: Gusty reads documents/)).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await docs.getByRole("button", { name: "Forget this document: Repair café plan.pdf" }).click();
  await expect(docs.getByText("Repair café plan.pdf")).toHaveCount(0);

  // Adding a document to an existing project.
  await docs.getByLabel("Choose a PDF").setInputFiles(pdf(1));
  await expect(docs.getByRole("button", { name: "Add this document" })).toBeEnabled();
  await docs.getByRole("button", { name: "Add this document" }).click();
  await expect(docs.getByText("Gusty has read your document.")).toBeVisible({ timeout: 20_000 });
  await expect(docs.getByText("Repair café plan.pdf")).toBeVisible();
});

test("uploads only come from Gusty's own pages", async ({ request, baseURL }) => {
  const multipart = { file: pdf(), lang: "en" };
  const foreign = await request.post("/api/documents", { headers: { origin: "https://evil.example" }, multipart });
  expect(foreign.status()).toBe(403);
  const own = await request.post("/api/documents", { headers: { origin: new URL(baseURL!).origin }, multipart });
  expect(own.status()).toBe(200);
});
