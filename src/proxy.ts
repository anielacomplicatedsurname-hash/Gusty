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
  // If Supabase ever falls back to the site's home page with a sign-in code, finish signing in anyway.
  const code = request.nextUrl.searchParams.get("code");
  if (code && (pathname === "/" || locales.some((locale) => pathname === `/${locale}`))) {
    const confirm = new URL("/api/auth/confirm", brand.siteUrl);
    confirm.searchParams.set("code", code);
    return NextResponse.redirect(confirm);
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
