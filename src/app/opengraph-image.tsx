import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { renderBaseMapSvg } from "@/features/map/render-base-map";

export const alt = "Landhotel Gasthof Zur Krone, Leidersbach";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share image (OpenGraph/Twitter): our stylised site plan + word mark. */
const fontDir = path.join(process.cwd(), "node_modules/@fontsource/cormorant-garamond/files");

export default async function OpengraphImage() {
  const [serif, serifItalic, fraktur] = await Promise.all([
    readFile(path.join(fontDir, "cormorant-garamond-latin-600-normal.woff")),
    readFile(path.join(fontDir, "cormorant-garamond-latin-500-italic.woff")),
    readFile(path.join(process.cwd(), "node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff")),
  ]);
  const map = `data:image/svg+xml;base64,${Buffer.from(renderBaseMapSvg()).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#1c1917" }}>
        <img src={map} alt="" width={1200} height={800} style={{ position: "absolute", top: -60, left: 0, width: 1200, height: 800, opacity: 0.9 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            background: "linear-gradient(90deg, rgba(28,25,23,0.95) 0%, rgba(28,25,23,0.78) 48%, rgba(28,25,23,0.05) 100%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", color: "#fbf8f2", fontFamily: "Cormorant", fontWeight: 600, fontStyle: "normal" }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, color: "#d8bb7e" }}>LANDHOTEL · GASTHOF · LEIDERSBACH</div>
          <div style={{ display: "flex", fontSize: 120, marginTop: 10, fontFamily: "Fraktur", fontWeight: 400 }}>Zur Krone</div>
          <div style={{ display: "flex", width: 120, height: 2, background: "#b8904a", marginTop: 26 }} />
          <div style={{ display: "flex", fontSize: 52, marginTop: 28, fontFamily: "Cormorant" }}>
            Willkommen&nbsp;<span style={{ color: "#d8bb7e", fontStyle: "italic" }}>in der Krone.</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, marginTop: 18, color: "rgba(251,248,242,0.75)" }}>Gaststube · Säle · Wintergarten · Biergarten · Hotel</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant", data: serif, weight: 600, style: "normal" },
        { name: "Cormorant", data: serifItalic, weight: 500, style: "italic" },
        { name: "Fraktur", data: fraktur, weight: 400, style: "normal" },
      ],
    },
  );
}
