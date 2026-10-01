import { expect, test } from "@playwright/test";

// With motion the planner lives at the end of the scroll film (see planner.spec.ts);
// these tests drive the full configurator, which is the reduced-motion version.
test.use({ contextOptions: { reducedMotion: "reduce" } });

test("Mobile: Karte oben, Sticky-CTA zeigt Anzahl, Bottom Sheet mit Auswahl", async ({ page }) => {
  await page.goto("/#karte");
  const map = page.getByTestId("site-map").first();
  await map.locator('[data-space="restaurant"]').click();
  await map.locator('[data-space="beer-garden"]').click();
  // the desktop side panel carries the same text but is hidden on phones
  await expect(page.getByText("2 Bereiche ausgewählt").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /2 Bereiche ausgewählt/ }).click();
  const sheet = page.getByRole("dialog", { name: "Ihre Auswahl" });
  await expect(sheet.getByTestId("selected-list").locator("li")).toHaveCount(2);
});

test("Mobile: Menü öffnet und navigiert", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menü öffnen" }).click();
  await page.getByRole("navigation", { name: "Mobile Navigation" }).getByRole("link", { name: "Bereiche" }).click();
  await page.waitForURL(/\/bereiche$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Räume");
});
