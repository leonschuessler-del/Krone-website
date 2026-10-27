import { expect, test } from "@playwright/test";

/**
 * Operator rule (10/2026): no prices anywhere on the public event-location site – everything is "auf Anfrage".
 * Checks the full HTML source (incl. the RSC/flight payload that carries client props) of every public page
 * and the public JSON APIs for currency amounts and price fields.
 */
const PAGES = ["/", "/bereiche", "/galerie", "/kontakt", "/faq", "/buchen", "/impressum", "/datenschutz", "/agb", "/mietbedingungen", "/hausordnung"];
const AMOUNT = /\d[\d.,]*\s?(?:€|&euro;|\\u20ac|EUR\b)|(?:€|EUR)\s?\d/i;
const PRICE_KEYS = /"(?:unitPrice|basePrice|baseRate|hourlyRate|pricePerNight|basePricePerNight|deposit(?:Amount)?|total(?:Cents|Gross)?|subtotal|priceRange|minPrice|pricing)"\s*:\s*(?:\d|\{|\[)/;

test.describe("Keine Preise auf der öffentlichen Seite", () => {
  for (const path of PAGES) {
    test(`Seite ${path}`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      expect(html.match(AMOUNT)?.[0] ?? null, `Betrag auf ${path}`).toBeNull();
      expect(html.match(PRICE_KEYS)?.[0] ?? null, `Preisfeld im Payload von ${path}`).toBeNull();
    });
  }

  test("Raum-Detailseiten", async ({ request }) => {
    const spaces = (await (await request.get("/api/spaces")).json()) as { spaces?: Array<{ slug: string }> };
    const list = spaces.spaces ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) {
      const html = await (await request.get(`/bereiche/${s.slug}`)).text();
      expect(html.match(AMOUNT)?.[0] ?? null, `Betrag auf /bereiche/${s.slug}`).toBeNull();
      expect(html.match(PRICE_KEYS)?.[0] ?? null, `Preisfeld auf /bereiche/${s.slug}`).toBeNull();
    }
  });

  test("Öffentliche APIs", async ({ request }) => {
    for (const path of ["/api/spaces", "/api/extras"]) {
      const body = await (await request.get(path)).text();
      expect(body.match(PRICE_KEYS)?.[0] ?? null, path).toBeNull();
      expect(body.match(AMOUNT)?.[0] ?? null, path).toBeNull();
    }
    const calc = await request.post("/api/pricing/calculate", { data: { spaceIds: ["restaurant"] } });
    expect(calc.status()).toBe(404);
  });

  test("Weiterleitungen alter Adressen", async ({ request }) => {
    for (const [from, to] of [["/eventlocation", "/"], ["/bereiche/hotel", "/#hotel"]] as const) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect([301, 307, 308], from).toContain(res.status());
      expect(res.headers()["location"], from).toContain(to);
    }
    for (const gone of ["/hotel", "/hotel/buchen", "/aktuelles", "/sehenswuerdigkeiten"]) {
      expect((await request.get(gone)).status(), gone).toBe(404);
    }
  });
});
