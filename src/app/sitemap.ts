import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { locales } from "@/i18n/config";

/** Public, indexable pages only. Add a path here when a public page becomes real. */
const publicPaths = ["", "/support", "/expert", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${brand.siteUrl}/${locale}${path}`,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${brand.siteUrl}/${l}${path}`])),
      },
    })),
  );
}
