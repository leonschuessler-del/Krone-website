import type { Metadata } from "next";

/** Brand used in the title template of the root layout (`%s · Eventlocation Zur Krone`). */
export const SITE_TITLE = "Eventlocation Zur Krone";
/** og:site_name – identical on every page. */
export const OG_SITE_NAME = "Eventlocation Zur Krone Leidersbach";

/**
 * Default share image: the file-based `src/app/opengraph-image.tsx`.
 * Next only attaches that file to the root segment; as soon as a page sets its
 * own `openGraph`, the parent object is replaced without merging – so the image
 * is referenced explicitly here.
 */
const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Eventlocation Zur Krone, Leidersbach",
  type: "image/png",
} as const;

type PageMetaInput = {
  /** Page title. Without `absolute` the root template appends "· Eventlocation Zur Krone". */
  title: string;
  /** Use `title` as-is (no template) – e.g. for the home page. */
  absolute?: boolean;
  description?: string;
  /** Site-relative path, e.g. "/galerie". Omit for private pages (no canonical, no og:url). */
  path?: string;
  /** Share title if it should differ from the full page title. */
  ogTitle?: string;
  /** Share images; defaults to the generated site image. */
  images?: string[];
  /** Keep the page out of search indexes. */
  noindex?: boolean;
  /** With `noindex`: also tell crawlers not to follow links. */
  nofollow?: boolean;
};

/**
 * Consistent per-page metadata: title, description, canonical and a complete
 * OpenGraph/Twitter set (type, locale, siteName, url). `metadataBase` from the
 * root layout turns relative paths into absolute URLs.
 */
export function pageMeta({ title, absolute, description, path, ogTitle, images, noindex, nofollow }: PageMetaInput): Metadata {
  // title.template is not applied to openGraph.title, so build the full title here.
  const fullTitle = absolute ? title : `${title} · ${SITE_TITLE}`;
  const shareTitle = ogTitle ?? fullTitle;
  return {
    title: absolute ? { absolute: title } : title,
    ...(description && { description }),
    ...(path && { alternates: { canonical: path } }),
    ...(noindex && { robots: { index: false, follow: !nofollow } }),
    openGraph: {
      type: "website",
      locale: "de_DE",
      siteName: OG_SITE_NAME,
      title: shareTitle,
      ...(description && { description }),
      ...(path && { url: path }),
      images: images?.length ? images : [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      ...(description && { description }),
    },
  };
}
