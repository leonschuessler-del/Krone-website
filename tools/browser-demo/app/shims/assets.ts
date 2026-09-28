/** Absolute site paths (/media/…, /map/…) → paths relative to the demo page. */
export function assetUrl(src: string): string {
  if (src.startsWith("/") && !src.startsWith("//")) return src.slice(1);
  return src;
}

export function fixCssUrls(value: string): string {
  return value.replace(/url\((['"]?)\/(?!\/)/g, "url($1");
}
