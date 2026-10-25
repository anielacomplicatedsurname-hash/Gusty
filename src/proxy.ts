import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";
import { brand } from "@/config/brand";
import { canonicalRedirect } from "@/config/site-url";
import { refreshSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const canonical = canonicalRedirect(request.headers.get("host"), brand.siteUrl);
  if (canonical) {
    return NextResponse.redirect(new URL(pathname + request.nextUrl.search, canonical), 308);
  }
  const hasLocalePrefix = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  // Send locale-less paths to the default locale, e.g. "/" → "/en".
  if (!hasLocalePrefix) {
    request.nextUrl.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  return refreshSession(request, NextResponse.next({ request }));
}

export const config = {
  // Skip Next internals, API routes and any file with an extension (icons, manifest, robots…).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
