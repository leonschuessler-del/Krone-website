import { expect, test } from "@playwright/test";

const plus = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

test.describe("Zimmerbuchung (Buchungsmaschine)", () => {
  test("Suche → Zimmer → Kasse → Bestätigung mit Reservierungsnummer", async ({ page }) => {
    await page.goto(`/hotel/buchen?anreise=${plus(20)}&abreise=${plus(23)}&erwachsene=2`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Zimmer");
    // search bar shows guests and dates
    await expect(page.getByTestId("field-guests")).toContainText("2 Erwachsene");
    // room cards with rates
    await expect(page.getByTestId("room-double")).toBeVisible();
    await expect(page.getByTestId("rate-double-flex")).toContainText("Frühstück");
    await expect(page.getByTestId("rate-double-flex")).toContainText("3 Nächte");
    // sort by lowest price → single room first
    await page.getByTestId("ctl-sort").click();
    await page.getByRole("menuitemradio", { name: "Niedrigster Preis" }).click();
    const names = await page.getByTestId("room-list").locator("article h3").allTextContents();
    expect(names[0]).toContain("Einzelzimmer");
    // filter panel: only Doppelzimmer
    await page.getByTestId("ctl-filter").click();
    await expect(page.getByTestId("filter-panel")).toBeVisible();
    await page.getByTestId("filter-cat-double").check({ force: true });
    await page.getByTestId("filter-apply").click();
    await expect(page.getByTestId("room-list").locator("article")).toHaveCount(1);
    // book → checkout with price details
    await page.getByTestId("book-double").click();
    await expect(page.getByTestId("checkout")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toContainText("300,00");
    await expect(page.getByTestId("cart-button")).toContainText("1 Zimmer");
    // add a second room via the cart
    await page.getByTestId("cart-button").click();
    await expect(page.getByTestId("cart-view")).toBeVisible();
    await page.getByTestId("cart-add-room").click();
    await expect(page.getByRole("heading", { name: "Zimmer 2 wählen" })).toBeVisible();
    await page.getByTestId("book-single").click();
    await expect(page.getByTestId("cart-total")).toContainText("504,00");
    // the cart survives a reload
    await page.reload();
    await expect(page.getByTestId("checkout")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toContainText("504,00");
    // contact + confirm
    await page.getByTestId("co-first").fill("Erika");
    await page.getByTestId("co-last").fill("Muster");
    await page.getByTestId("co-phone").fill("0160 1234567");
    await page.getByTestId("co-email").fill("erika@example.com");
    await page.getByTestId("pay-hotel").check({ force: true });
    await page.getByTestId("co-accept").check();
    await page.getByTestId("co-submit").click();
    await expect(page.getByTestId("engine-done")).toBeVisible();
    await expect(page.getByTestId("done-number")).toHaveText(/^HZ-\d{4}-[A-Z0-9]{5}$/);
    // back to the rooms with an empty cart
    await page.getByRole("button", { name: "Weitere Zimmer buchen" }).click();
    await expect(page.getByTestId("cart-button")).toContainText("leer");
  });

  test("Kalender zeigt Tagespreise und die Summe für den Aufenthalt", async ({ page }) => {
    await page.goto("/hotel/buchen");
    await expect(page.getByTestId("dates-panel")).toBeVisible();
    const day = page.locator(`[data-date="${plus(30)}"]`);
    await expect(day).toContainText("68 €");
    await day.click();
    await page.locator(`[data-date="${plus(32)}"]`).click();
    await expect(page.getByTestId("dates-summary")).toContainText("Ab 136,00 € gesamt für 2 Nächte");
    await page.getByTestId("search-submit").click();
    await expect(page.getByTestId("field-arrival")).not.toContainText("Datum wählen");
    await expect(page.getByTestId("room-list").locator("article").first()).toBeVisible();
  });

  test("Startseite: Buchungsleiste führt zur Buchungsseite mit Daten", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("booking-bar").getByRole("button", { name: "Verfügbarkeit prüfen" }).click();
    await page.waitForURL(/\/hotel\/buchen\?anreise=/);
    await expect(page.getByTestId("room-list")).toBeVisible();
  });
});
