import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getMessages } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { AccountBadge } from "./AccountBadge";
import { Logo } from "./Logo";
import { NavLinks, NavList, type NavItem } from "./NavLinks";

/**
 * Responsive frame. Under 768px: compact header + fixed bottom bar with the three
 * destinations. From 768px (tablet and desktop): the same destinations in the header.
 */
export async function AppShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = await getMessages();
  const items: NavItem[] = [
    { href: `/${locale}/explore`, label: t.nav.explore, symbol: "horizon-hill" },
    { href: `/${locale}/projects`, label: t.nav.projects, symbol: "sprout" },
    { href: `/${locale}/connections`, label: t.nav.connections, symbol: "gathering" },
  ];

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {t.common.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-border/70 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex h-(--header-height) max-w-(--content-max) items-center justify-between px-4 sm:px-6">
          <Link href={`/${locale}`} aria-label={t.common.home} className="flex items-center">
            <Logo variant="primary" height={34} alt="" priority />
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <nav aria-label={t.nav.label} className="hidden md:block">
              <Suspense fallback={<NavList items={items} variant="top" pathname={null} />}>
                <NavLinks items={items} variant="top" />
              </Suspense>
            </nav>
            <Suspense fallback={null}>
              <AccountBadge locale={locale} label={t.common.signedInAs} />
            </Suspense>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="flex-1 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] md:pb-0"
      >
        {children}
      </main>

      <footer className="mb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] border-t border-border/70 md:mb-0">
        <div className="mx-auto flex max-w-(--content-max) flex-col gap-2 px-4 py-8 text-sm text-text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
          <Logo variant="wordmark" height={22} />
          <p>{t.footer.tagline}</p>
        </div>
      </footer>

      <nav
        aria-label={t.nav.label}
        data-testid="bottom-nav"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="h-(--bottom-nav-height)">
          <Suspense fallback={<NavList items={items} variant="bottom" pathname={null} />}>
            <NavLinks items={items} variant="bottom" />
          </Suspense>
        </div>
      </nav>
    </>
  );
}
