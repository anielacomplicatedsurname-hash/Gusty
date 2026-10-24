import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    // Private areas stay out of search engines (directive §17). Access control is enforced
    // separately; robots.txt is only a crawl hint.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/*/projects", "/*/admin"] },
    sitemap: `${brand.siteUrl}/sitemap.xml`,
  };
}
