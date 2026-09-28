import { chromium } from "playwright";
import path from "node:path";
const file = process.argv[2];
const out = process.argv[3];
const browser = await chromium.launch();
for (const [name, vp] of [["panel", { width: 720, height: 900 }], ["desk", { width: 1366, height: 820 }], ["phone", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === "phone", hasTouch: name === "phone" });
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (!u.startsWith("file:") && !u.startsWith("data:")) requests.push(u);
    return u.startsWith("file:") || u.startsWith("data:") ? route.continue() : route.abort();
  });
  page.on("pageerror", (e) => errors.push("pageerror " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("file://" + file, { waitUntil: "load" });
  await page.waitForTimeout(800);
  const H = await page.evaluate(() => document.getElementById("rundgang").offsetHeight - innerHeight);
  const shots = name === "desk" ? [0, 0.12, 0.3, 0.55, 0.78, 0.97] : [0, 0.3, 0.97];
  for (const f of shots) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), Math.round(H * f));
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, `${name}-tour-${Math.round(f * 100)}.png`) });
  }
  // map
  await page.evaluate(() => window.scrollTo({ top: document.getElementById("karte").offsetTop, behavior: "instant" }));
  await page.waitForTimeout(900);
  for (const id of ["restaurant", "stage"]) await page.locator(`#karte g[data-space-id="${id}"]`).first().click({ force: true });
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => ({
    count: document.querySelector("[data-testid=selection-count]")?.textContent,
    selected: [...document.querySelectorAll("#karte g[data-selected=true]")].map((g) => g.dataset.spaceId),
    header: document.querySelector("header")?.className.slice(0, 80),
    mobile: document.querySelector("[data-pv-mobile-count]")?.textContent,
  }));
  await page.screenshot({ path: path.join(out, `${name}-map.png`) });
  // room modal via "Details"
  const details = page.locator("[data-pv-list] [data-room]").first();
  if (await details.isVisible()) await details.click();
  else await page.locator("#bereiche [data-room]").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `${name}-room.png`) });
  const modal = await page.evaluate(() => document.querySelector(".pv-card h2")?.textContent);
  await page.keyboard.press("Escape");
  // live dialog
  await page.locator("header [data-live]").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  const live = await page.evaluate(() => document.querySelector(".pv-card h2")?.textContent);
  console.log(name, JSON.stringify({ H, state, modal, live, errors, requests: requests.slice(0, 5) }));
  await ctx.close();
}
await browser.close();
