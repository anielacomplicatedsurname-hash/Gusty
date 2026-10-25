"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandSymbol, type SymbolName } from "./BrandSymbol";

export type NavItem = { href: string; label: string; symbol: SymbolName };

type Props = { items: NavItem[]; variant: "top" | "bottom" };

/** The three destinations with the current one highlighted. */
export function NavLinks(props: Props) {
  return <NavList {...props} pathname={usePathname()} />;
}

/**
 * The three destinations, shared by the desktop header and the mobile bottom bar.
 * Rendered without a highlight while the current path is not yet known.
 */
export function NavList({ items, variant, pathname }: Props & { pathname: string | null }) {
  return (
    <ul className={variant === "bottom" ? "grid h-full grid-cols-3" : "flex items-center gap-1"}>
      {items.map((item) => {
        const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <li key={item.href} className={variant === "bottom" ? "h-full" : undefined}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                variant === "bottom"
                  ? `flex h-full flex-col items-center justify-center gap-1 text-xs font-medium ${
                      active ? "text-ink" : "text-text-muted"
                    }`
                  : `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-ink text-paper" : "text-ink hover:bg-oat"
                    }`
              }
            >
              {variant === "bottom" && (
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full ${
                    active ? "bg-signal" : ""
                  }`}
                >
                  <BrandSymbol name={item.symbol} size={22} />
                </span>
              )}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
