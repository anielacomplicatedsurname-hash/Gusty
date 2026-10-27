import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
import { hashTransferSecret, TRANSFER_COOKIE } from "@/modules/projects/transfer";
import { signInDestination } from "@/modules/projects/validation";

/** Where email sign-in and "keep my projects" links land. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const supabase = await createSupabaseServerClient();

  let ok = false;
  if (supabase) {
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    if (code) {
      ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } else if (tokenHash && type) {
      ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    }

    // A guest who chose "Sign in and keep my projects" on this device: move their projects across.
    const cookieStore = await cookies();
    const secret = cookieStore.get(TRANSFER_COOKIE)?.value;
    if (ok && secret) {
      const { error } = await supabase.rpc("claim_guest_projects", { p_token_hash: hashTransferSecret(secret) });
      if (error) console.error("Bringing guest projects failed:", error.message);
      cookieStore.delete({ name: TRANSFER_COOKIE, path: "/api/auth" });
    }
  }

  return NextResponse.redirect(
    signInDestination(searchParams.get("next"), ok, brand.siteUrl, `/${defaultLocale}/projects`),
  );
}
