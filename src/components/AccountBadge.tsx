import Link from "next/link";
import { fill } from "@/i18n/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Shows who is signed in, on every page. Guests and signed-out visitors see nothing here. */
export async function AccountBadge({ locale, label }: { locale: string; label: string }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
  if (!email || data?.claims?.is_anonymous) return null;

  return (
    <Link
      href={`/${locale}/account`}
      title={fill(label, { email })}
      aria-label={fill(label, { email })}
      className="flex min-h-11 min-w-0 items-center gap-2 rounded-full px-1 text-sm font-medium hover:bg-oat/70 sm:pr-3"
    >
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-sage text-ink">
        {email[0].toUpperCase()}
      </span>
      <span aria-hidden="true" className="hidden max-w-48 truncate sm:inline">
        {email}
      </span>
    </Link>
  );
}
