import { resolveSiteUrl } from "./site-url";

/**
 * Brand configuration. The white-label seam: another organisation's deployment swaps
 * this object (and the assets it points to) without touching components.
 * The public brand name is "Gusty" (founder decision, 2026-10-24).
 */
export const brand = {
  name: "Gusty",
  siteUrl: resolveSiteUrl(),
  themeColor: "#111111",
  backgroundColor: "#f7f6f0",
  logo: {
    primary: "/brand/logo/gusty-primary.svg",
    stacked: "/brand/logo/gusty-stacked.svg",
    icon: "/brand/logo/gusty-icon.svg",
    wordmark: "/brand/logo/gusty-wordmark.svg",
    hey: "/brand/logo/gusty-hey.svg",
  },
} as const;

export type Brand = typeof brand;
