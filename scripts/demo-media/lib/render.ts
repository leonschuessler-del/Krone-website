/**
 * Renders SVG illustrations in headless Chromium (Playwright) and encodes
 * them as WebP with sharp. Every published still gets the baked-in
 * "BEISPIELBILD · Illustration" badge; an unlabelled PNG is kept in memory as
 * source material for the Ken-Burns tour videos.
 */
import type { Browser, Page } from "@playwright/test";
import sharp from "sharp";
import { fontFaceCss, SANS } from "./fonts";

export const IMG_W = 1600;
export const IMG_H = 1067;

export const BADGE_IMAGE = "Beispielbild · Illustration";
export const BADGE_FILM = "Beispielfilm · Illustration";

/** CSS for the demo badge; `scale` = output width / 1600. */
export function badgeCss(scale = 1): string {
  const px = (n: number) => `${Math.round(n * scale * 10) / 10}px`;
  return `.demo-badge{position:absolute;right:${px(22)};bottom:${px(20)};display:flex;align-items:center;gap:${px(8)};
    padding:${px(6)} ${px(14)} ${px(7)};border-radius:999px;background:rgba(28,25,23,.58);
    border:1px solid rgba(216,187,126,.38);color:#f4eee2;font-family:${SANS};font-weight:600;
    font-size:${px(14)};line-height:1;letter-spacing:.09em;font-variant-caps:all-small-caps;
    font-feature-settings:"c2sc","smcp";box-shadow:0 ${px(4)} ${px(14)} rgba(0,0,0,.18);
    -webkit-backdrop-filter:blur(${px(4)});backdrop-filter:blur(${px(4)});white-space:nowrap}
  .demo-badge i{display:block;width:${px(6)};height:${px(6)};border-radius:50%;background:#d8bb7e;opacity:.9}`;
}

export async function newImagePage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: IMG_W, height: IMG_H }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss()}
    html,body{margin:0;background:#f4eee2;overflow:hidden}
    #stage{position:relative;width:${IMG_W}px;height:${IMG_H}px;overflow:hidden}
    #art svg{display:block}
    ${badgeCss(1)}
    </style></head><body><div id="stage"><div id="art"></div><div class="demo-badge" id="badge"><i></i><span>${BADGE_IMAGE}</span></div></div></body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

export interface RenderedStill {
  /** PNG with badge */
  labelled: Buffer;
  /** PNG without badge (video source) */
  clean: Buffer;
}

export async function renderSvg(page: Page, svg: string): Promise<RenderedStill> {
  await page.evaluate((markup) => {
    const art = document.getElementById("art");
    if (art) art.innerHTML = markup;
    const badge = document.getElementById("badge");
    if (badge) badge.style.display = "flex";
  }, svg);
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  const clip = { x: 0, y: 0, width: IMG_W, height: IMG_H };
  const labelled = await page.screenshot({ type: "png", clip });
  await page.evaluate(() => {
    const badge = document.getElementById("badge");
    if (badge) badge.style.display = "none";
  });
  await settle(page);
  const clean = await page.screenshot({ type: "png", clip });
  return { labelled, clean };
}

/** WebP encode, stepping quality down until the file fits the budget. */
export async function toWebp(png: Buffer, opts: { width?: number; height?: number; maxBytes?: number; quality?: number } = {}): Promise<{ buf: Buffer; quality: number }> {
  const max = opts.maxBytes ?? 250 * 1024;
  let q = opts.quality ?? 80;
  let buf: Buffer = Buffer.alloc(0);
  for (;;) {
    let img = sharp(png);
    if (opts.width && opts.height) img = img.resize(opts.width, opts.height, { fit: "cover", position: "centre" });
    buf = await img.webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer();
    if (buf.length <= max || q <= 55) break;
    q -= 4;
  }
  return { buf, quality: q };
}
