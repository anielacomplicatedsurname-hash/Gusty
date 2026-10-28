"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Footer link that remembers which page the person was on (ids are removed when saved). */
export function FeedbackLink({ locale, label, className }: { locale: string; label: string; className: string }) {
  const pathname = usePathname();
  const from = pathname && !pathname.endsWith("/feedback") ? `?from=${encodeURIComponent(pathname)}` : "";
  return (
    <Link href={`/${locale}/feedback${from}`} className={className}>
      {label}
    </Link>
  );
}
