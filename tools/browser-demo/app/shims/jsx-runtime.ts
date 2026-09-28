/**
 * jsx runtime wrapper: host elements get absolute asset URLs rewritten to
 * relative ones (the demo is served from a sub path).
 */
import * as R from "react/jsx-runtime";
import { assetUrl, fixCssUrls } from "./assets";

const ASSET = /^\/(media|map)\//;

function fix(type: unknown, props: Record<string, unknown> | null) {
  if (typeof type !== "string" || !props) return props;
  let out = props;
  for (const key of ["src", "poster"]) {
    const v = out[key];
    if (typeof v === "string" && ASSET.test(v)) out = { ...out, [key]: assetUrl(v) };
  }
  if (type === "a" && typeof out.href === "string" && ASSET.test(out.href)) out = { ...out, href: assetUrl(out.href) };
  if (typeof out.srcSet === "string" && out.srcSet.includes("/media/")) out = { ...out, srcSet: out.srcSet.replace(/(^|,\s*)\//g, "$1") };
  const style = out.style as Record<string, unknown> | undefined;
  if (style && typeof style.backgroundImage === "string" && style.backgroundImage.includes("url(")) {
    out = { ...out, style: { ...style, backgroundImage: fixCssUrls(style.backgroundImage) } };
  }
  return out;
}

export const Fragment = R.Fragment;
export function jsx(type: never, props: never, key?: never) {
  return R.jsx(type, fix(type, props) as never, key);
}
export function jsxs(type: never, props: never, key?: never) {
  return R.jsxs(type, fix(type, props) as never, key);
}
