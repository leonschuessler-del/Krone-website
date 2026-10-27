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
  await page.getByRole("navigation", { name: "Mobile Navigation" }).getByRole("link", { name: "Galerie" }).click();
  await page.waitForURL(/\/galerie$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Mobile: Menü ist auch nach dem Scrollen vollständig sichtbar und schließt mit Escape", async ({ page }) => {
  await page.goto("/galerie");
  await page.evaluate(() => window.scrollTo(0, 800));
  const toggle = page.getByRole("button", { name: "Menü öffnen" });
  await toggle.click();
  const nav = page.getByRole("navigation", { name: "Mobile Navigation" });
  await expect(nav.getByRole("link", { name: "Kontakt" })).toBeInViewport();
  await expect(page.locator("#mobile-nav").getByRole("link", { name: "Termin anfragen" })).toBeInViewport();
  const box = await page.locator("#mobile-nav").boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(400);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Menü öffnen" })).toHaveAttribute("aria-expanded", "false");
});

test("Mobile: Anker der Startseite landen von Unterseiten aus am richtigen Abschnitt", async ({ page }) => {
  await page.goto("/faq");
  await page.goto("/#bereiche");
  await expect(page.locator("#bereiche")).toBeInViewport();
  await page.goto("/galerie");
  await page.goto("/#hotel");
  await expect(page.locator("#hotel")).toBeInViewport();
});
