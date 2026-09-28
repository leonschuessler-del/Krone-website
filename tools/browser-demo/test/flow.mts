// End-to-end check of the browser demo (same steps as tests/e2e/booking.spec.ts).
import { chromium, type Page } from "playwright";
import { getDemoScenario } from "../../../src/content/demo-scenario";

const url = process.argv[2]!;
const out = process.argv[3]!;
const scenario = getDemoScenario();

async function pickDate(page: Page, date: string) {
  for (let i = 0; i < 4 && (await page.locator(`[data-date="${date}"]`).count()) === 0; i++) {
    await page.getByLabel("Nächster Monat").click();
  }
  await page.locator(`[data-date="${date}"]`).click();
}
const expectText = async (page: Page, testId: string, re: RegExp, root = page.locator("body")) => {
  const el = root.getByTestId(testId).first();
  await el.waitFor({ timeout: 15000 });
  for (let i = 0; i < 50; i++) {
    const t = (await el.textContent()) ?? "";
    if (re.test(t)) return t;
    await page.waitForTimeout(200);
  }
  throw new Error(`${testId}: "${await el.textContent()}" !~ ${re}`);
};

const browser = await chromium.launch();
for (const [name, viewport, mobile] of [
  ["desktop", { width: 1366, height: 820 }, false],
  ["phone", { width: 390, height: 844 }, true],
] as const) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __DEMO_STATE__?: string }).__DEMO_STATE__ === "ready", null, { timeout: 90000 });

  // 1) map: 3 spaces, date with blocked winter garden → "2 von 3"
  await page.evaluate(() => document.getElementById("karte")!.scrollIntoView());
  await page.waitForTimeout(600);
  const map = page.getByTestId("site-map").first();
  for (const id of ["restaurant", "stage", "winter-garden"]) await map.locator(`[data-space="${id}"]`).click();
  await page.getByTestId("open-schedule").first().click();
  await pickDate(page, scenario.winterGardenBookedDate);
  await page.getByTestId("start-time").selectOption("16:00");
  await page.getByTestId("end-time").selectOption("23:00");
  const dialog = page.getByRole("dialog");
  const summary = await expectText(page, "availability-summary", /2 von 3/, dialog);
  await page.screenshot({ path: `${out}/${name}-schedule.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-map-status.png` });

  // 2) full booking in the wizard
  await page.evaluate(() => (window as unknown as { __demoNavigate: (h: string) => void }).__demoNavigate("/buchen?spaces=restaurant,stage,beer-garden"));
  await expectText(page, "step-title", /Bereiche/);
  await page.getByTestId("wizard-next").click();
  await pickDate(page, scenario.winterGardenBookedDate);
  await page.getByTestId("start-time").selectOption("15:00");
  await page.getByTestId("end-time").selectOption("23:00");
  await expectText(page, "availability-summary", /Alle ausgewählten Bereiche sind verfügbar/);
  const total = await expectText(page, "quote-total", /\d/);
  await page.screenshot({ path: `${out}/${name}-wizard-date.png` });
  for (let i = 0; i < 5; i++) {
    await page.getByTestId("wizard-next").click();
    await page.waitForTimeout(600);
    if (/Zusatzoptionen/.test((await page.getByTestId("step-title").first().textContent()) ?? "")) break;
    console.log("  (date step not advanced yet, retrying)", await page.locator("[role=alert], .field-error").allTextContents());
  }
  await expectText(page, "step-title", /Zusatzoptionen/);
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
  await expectText(page, "step-title", /Übergabe/);
  await page.locator('input[name="handover"]').last().check();
  await page.locator('input[name="return"]').first().check();
  await page.getByTestId("wizard-next").click();
  for (const id of ["house_rules", "rental_terms", "cancellation", "deposit", "handover", "privacy"]) await page.getByTestId(`term-${id}`).check();
  await page.getByTestId("wizard-next").click();
  await expectText(page, "step-title", /Zahlung/);
  await page.getByTestId("wizard-submit").click();
  await page.getByTestId("demo-pay-success").click();
  const number = await expectText(page, "booking-number", /^KR-\d{4}-[2-9A-Z]{5}$/);
  const status = await expectText(page, "booking-status", /Bestätigt/);
  await page.screenshot({ path: `${out}/${name}-confirmation.png`, fullPage: false });
  const hash = await page.evaluate(() => location.hash);

  // 3) same slot again → the booked restaurant must now be unavailable (double-booking guard)
  const again = await page.evaluate(async (date) => {
    const r = await fetch("/api/availability/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spaceIds: ["restaurant", "side-room"], rentalMode: "hourly", date, startTime: "16:00", endTime: "20:00" }),
    });
    const j = await r.json();
    return j.summary?.message ?? JSON.stringify(j).slice(0, 200);
  }, scenario.winterGardenBookedDate);

  // 4) detail page + back
  await page.evaluate(() => (window as unknown as { __demoNavigate: (h: string) => void }).__demoNavigate("/bereiche/wintergarten"));
  await page.waitForTimeout(800);
  const h1 = await page.locator("h1").first().textContent();
  await page.screenshot({ path: `${out}/${name}-detail.png` });
  await page.goBack();
  await page.waitForTimeout(800);
  const afterBack = await page.evaluate(() => location.hash);

  console.log(name, JSON.stringify({ summary, total, number, status, hash, again, h1, afterBack, errors: errors.slice(0, 6) }));
  await ctx.close();
}
await browser.close();
