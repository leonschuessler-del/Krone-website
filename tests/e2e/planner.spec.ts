import { expect, test } from "@playwright/test";

test.describe("Raumplaner am Ende des Films", () => {
  test("Zur Karte springt in den Planer; Räume auf dem Foto und in der Liste wählen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Direkt zum Raumplaner" }).click();
    const section = page.locator("#rundgang");
    await expect(section).toHaveAttribute("data-planner", "on");
    const planner = page.locator("[data-tour-planner]");
    await expect(planner.getByRole("heading", { name: "Ihr Fest. Ihre Räume." })).toBeVisible();

    // label on the photo
    await page.locator('.tour-label[data-toggle-space="side-room"]').click();
    await expect(planner.locator('[data-toggle-space="side-room"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.tour-area[data-space-id="side-room"]')).toHaveAttribute("data-selected", "true");
    // list in the panel
    await planner.locator('[data-toggle-space="stage"]').click();
    await expect(planner.getByTestId("selection-count")).toHaveText("2 Bereiche ausgewählt");

    await planner.getByRole("button", { name: /Verfügbarkeit prüfen/ }).click();
    await expect(page.getByRole("dialog", { name: "Termin & Verfügbarkeit" })).toBeVisible();
  });

  test("Header-Link zur Karte öffnet den Planer", async ({ page }) => {
    await page.goto("/impressum");
    await expect(page.getByRole("heading", { level: 1, name: "Impressum" })).toBeVisible();
    await expect(page.getByText("DE 297367201")).toBeVisible();
    await page.goto("/#karte");
    await expect(page.locator("#rundgang")).toHaveAttribute("data-planner", "on");
  });
});
