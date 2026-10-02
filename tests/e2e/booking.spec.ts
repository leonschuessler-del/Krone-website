import { expect, test, type Page } from "@playwright/test";
import { getDemoScenario } from "../../src/content/demo-scenario";

const scenario = getDemoScenario();

// With motion the planner lives at the end of the scroll film (see planner.spec.ts);
// these tests drive the full configurator, which is the reduced-motion version.
test.use({ contextOptions: { reducedMotion: "reduce" } });

async function pickDate(page: Page, date: string) {
  for (let i = 0; i < 4 && (await page.locator(`[data-date="${date}"]`).count()) === 0; i++) {
    await page.getByLabel("Nächster Monat").click();
  }
  await page.locator(`[data-date="${date}"]`).click();
}

test.describe("Grundstückskarte & Multi-Select", () => {
  test("Bereiche per Klick und Tastatur auswählen", async ({ page }) => {
    await page.goto("/#karte");
    const map = page.getByTestId("site-map").first();
    // 6 bookable rooms on the photo (the kitchen is an add-on, hotel rooms are booked separately)
    await expect(map.locator("[data-space]")).toHaveCount(6);

    await map.locator('[data-space="restaurant"]').click();
    await map.locator('[data-space="stage"]').click();
    // keyboard: focus + Enter
    await map.locator('[data-space="winter-garden"]').focus();
    await page.keyboard.press("Enter");

    await expect(map.locator('[data-space="restaurant"]')).toHaveAttribute("aria-checked", "true");
    await expect(map.locator('[data-space="winter-garden"]')).toHaveAttribute("aria-label", /Wintergarten, .*, ausgewählt/);
    await expect(page.getByTestId("selection-count").first()).toHaveText("3 Bereiche ausgewählt");

    // deselect again
    await map.locator('[data-space="stage"]').click();
    await expect(page.getByTestId("selection-count").first()).toHaveText("2 Bereiche ausgewählt");
  });

  test("Test 59: blockierter Wintergarten → 2 von 3 verfügbar, entfernen macht buchbar", async ({ page }) => {
    await page.goto("/#karte");
    const map = page.getByTestId("site-map").first();
    for (const id of ["restaurant", "stage", "winter-garden"]) await map.locator(`[data-space="${id}"]`).click();
    await page.getByTestId("open-schedule").click();
    await pickDate(page, scenario.winterGardenBookedDate);
    await page.getByTestId("start-time").selectOption("16:00");
    await page.getByTestId("end-time").selectOption("23:00");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("availability-summary")).toHaveText("2 von 3 Bereichen verfügbar.");
    await expect(dialog.getByTestId("blocked-space")).toContainText("Wintergarten ist in diesem Zeitraum nicht verfügbar.");
    await expect(dialog.getByRole("button", { name: "Alternative Zeiten anzeigen" })).toBeVisible();

    // the map shows the blocked space immediately
    await page.keyboard.press("Escape");
    await expect(map.locator('[data-space="winter-garden"]')).toHaveAttribute("data-status", "unavailable");
    await expect(map.locator('[data-space="restaurant"]')).toHaveAttribute("data-status", "available");

    // (the blocked-space notice offers the same action – use the one in the selection list)
    await page.getByTestId("selection-panel").first().getByTestId("selected-list").getByRole("button", { name: /Wintergarten entfernen/ }).click();
    await expect(page.getByTestId("selection-panel").first().getByTestId("availability-summary")).toHaveText("Alle ausgewählten Bereiche sind verfügbar.");
  });

  test("Test 61: Gesamte Location zeigt konkret den blockierten Bereich", async ({ page }) => {
    await page.goto("/#karte");
    await page.getByTestId("full-venue").click();
    await expect(page.getByTestId("selection-count").first()).toHaveText("6 Bereiche ausgewählt");
    await page.getByTestId("open-schedule").click();
    await pickDate(page, scenario.winterGardenBookedDate);
    await page.getByTestId("start-time").selectOption("16:00");
    await page.getByTestId("end-time").selectOption("22:00");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("availability-summary")).toHaveText("5 von 6 Bereichen verfügbar.");
    await expect(dialog.getByTestId("blocked-space")).toHaveCount(1);
    await expect(dialog.getByTestId("blocked-space")).toContainText("Wintergarten");
  });
});

test("Test 60: komplette Anfrage Restaurant + Bühne + Biergarten bis zur Bestätigungsseite", async ({ page }) => {
  await page.goto("/buchen?spaces=restaurant,stage,beer-garden");
  await expect(page.getByTestId("step-title")).toContainText("Räume");
  await page.getByTestId("wizard-next").click();

  await pickDate(page, scenario.winterGardenBookedDate);
  await page.getByTestId("start-time").selectOption("15:00");
  await page.getByTestId("end-time").selectOption("23:00");
  await expect(page.getByTestId("availability-summary")).toHaveText("Alle ausgewählten Bereiche sind verfügbar.");
  await expect(page.getByTestId("quote-total")).not.toHaveText(/0,00/);
  await page.getByTestId("wizard-next").click();

  await expect(page.getByTestId("step-title")).toContainText("Zusatzleistungen");
  await page.getByTestId("wizard-next").click();

  await page.getByLabel("Art der Veranstaltung *").selectOption("company");
  await page.getByLabel("Voraussichtliche Personenzahl *").fill("90");
  await page.getByTestId("wizard-next").click();

  await page.getByLabel("Vorname *").fill("Erika");
  await page.getByLabel("Nachname *").fill("Mustermann");
  await page.getByLabel("E-Mail *").fill("erika@example.org");
  await page.getByLabel("Telefon *").fill("+49 6028 123456");
  await page.getByLabel("Straße *").fill("Musterweg");
  await page.getByLabel("Hausnummer *").fill("1");
  await page.getByLabel("PLZ *").fill("63849");
  await page.getByLabel("Ort *").fill("Leidersbach");
  await page.getByTestId("wizard-next").click();

  await expect(page.getByTestId("step-title")).toContainText("Übergabe");
  await page.locator('input[name="handover"]').last().check();
  await page.locator('input[name="return"]').first().check();
  await page.getByTestId("wizard-next").click();

  for (const id of ["house_rules", "rental_terms", "cancellation", "deposit", "handover", "privacy"]) await page.getByTestId(`term-${id}`).check();
  await page.getByTestId("wizard-next").click();

  // every booking is a request the operator confirms (no online payment)
  const inquiryRadio = page.getByRole("radio", { name: /Unverbindlich anfragen/ });
  if (await inquiryRadio.count()) await inquiryRadio.click();
  await page.getByTestId("wizard-submit").click();

  await page.waitForURL(/\/buchung\/KA-\d{4}-/);
  await expect(page.getByTestId("booking-number")).toHaveText(/^KA-\d{4}-[2-9A-Z]{5}$/);
  await expect(page.getByTestId("booking-status")).toHaveText("Anfrage");
  const spaces = page.getByTestId("booking-spaces").locator("li");
  await expect(spaces).toHaveCount(3);
  await expect(page.getByTestId("booking-spaces")).toContainText("Restaurant");
  await expect(page.getByTestId("booking-spaces")).toContainText("Bühne");
  await expect(page.getByTestId("booking-spaces")).toContainText("Biergarten");
});

test("Unverbindliche Anfrage erhält eigene Nummer", async ({ page }) => {
  await page.goto("/buchen?spaces=restaurant,side-room");
  await page.getByTestId("wizard-next").click();
  await pickDate(page, scenario.oldTavernReservedDate);
  await page.getByTestId("start-time").selectOption("12:00");
  await page.getByTestId("end-time").selectOption("16:00");
  await expect(page.getByTestId("availability-summary")).toHaveText(/verfügbar/);
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("wizard-next").click();
  await page.getByLabel("Art der Veranstaltung *").selectOption("birthday");
  await page.getByLabel("Voraussichtliche Personenzahl *").fill("25");
  await page.getByTestId("wizard-next").click();
  await page.getByLabel("Vorname *").fill("Max");
  await page.getByLabel("Nachname *").fill("Muster");
  await page.getByLabel("E-Mail *").fill("max@example.org");
  await page.getByLabel("Telefon *").fill("06028 99999");
  await page.getByLabel("Straße *").fill("Hauptstraße");
  await page.getByLabel("Hausnummer *").fill("2");
  await page.getByLabel("PLZ *").fill("63849");
  await page.getByLabel("Ort *").fill("Leidersbach");
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("step-title")).toContainText("Übergabe");
  await page.locator('input[name="handover"]').last().check();
  await page.locator('input[name="return"]').first().check();
  await page.getByTestId("wizard-next").click();
  // booking vs. inquiry is chosen on the next step, so all starred terms are asked here
  for (const id of ["house_rules", "rental_terms", "cancellation", "deposit", "handover", "privacy"]) await page.getByTestId(`term-${id}`).check();
  await page.getByTestId("wizard-next").click();
  const radio = page.getByRole("radio", { name: /Unverbindlich anfragen/ });
  if (await radio.count()) await radio.click();
  await page.getByTestId("wizard-submit").click();
  await page.waitForURL(/\/buchung\/KA-\d{4}-/);
  await expect(page.getByTestId("booking-status")).toHaveText("Anfrage");
});

test("Ohne Restaurant geht es nicht – der Planer nimmt es automatisch dazu", async ({ page }) => {
  await page.goto("/#karte");
  const map = page.getByTestId("site-map").first();
  await map.locator('[data-space="stage"]').click();
  await expect(map.locator('[data-space="restaurant"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("selection-count").first()).toHaveText("2 Bereiche ausgewählt");
});

test("Detailseite: Bereich auswählen und zurück zur Karte – Auswahl bleibt erhalten", async ({ page }) => {
  await page.goto("/bereiche/wintergarten");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wintergarten");
  await page.getByRole("button", { name: "Wintergarten auswählen" }).click();
  await page.getByRole("link", { name: /Zum Raumplaner/ }).first().click();
  await page.waitForURL(/#karte/);
  await expect(page.getByTestId("site-map").first().locator('[data-space="winter-garden"]')).toHaveAttribute("aria-checked", "true");
});

test("Wichtige Seiten und Links sind erreichbar", async ({ page, request }) => {
  for (const path of ["/", "/bereiche", "/bereiche/restaurant", "/bereiche/hotel", "/galerie", "/kontakt", "/faq", "/impressum", "/datenschutz", "/agb", "/mietbedingungen", "/hausordnung", "/buchen", "/sitemap.xml", "/robots.txt", "/map/base.svg"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
  }
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  expect(errors).toEqual([]);
});
