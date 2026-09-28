import { chromium } from "playwright";
const url = process.argv[2];
const b = await chromium.launch();
// (a) engine blocked → snapshot stays usable
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route("**/pg/**", (r) => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url); await p.waitForFunction(() => window.__DEMO_STATE__ === "failed", null, { timeout: 30000 });
  await p.evaluate(() => document.getElementById("karte").scrollIntoView()); await p.waitForTimeout(500);
  await p.locator('#karte g[data-space-id="restaurant"]').first().click({ force: true });
  const count = await p.locator("[data-testid=selection-count]").first().textContent();
  await p.locator("header [data-live]").first().click({ force: true }); await p.waitForTimeout(300);
  const dlg = await p.locator(".pv-card h2").textContent();
  console.log("blocked:", JSON.stringify({ count, dlg, errs }));
  await ctx.close();
}
// (b) slow engine → click "Jetzt buchen" while booting → continues to /buchen
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route("**/pg/pglite.gz.wasm", async (r) => { await new Promise((res) => setTimeout(res, 4000)); await r.continue(); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(800);
  const st = await p.evaluate(() => window.__DEMO_STATE__);
  await p.locator("header [data-live]").first().click({ force: true }); await p.waitForTimeout(300);
  const dlg = await p.locator(".pv-card .pv-eyebrow").textContent();
  await p.waitForFunction(() => window.__DEMO_STATE__ === "ready", null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const hash = await p.evaluate(() => location.hash);
  const title = await p.locator("[data-testid=step-title]").first().textContent().catch(() => null);
  console.log("slow:", JSON.stringify({ st, dlg, hash, title, errs }));
  await ctx.close();
}
await b.close();
