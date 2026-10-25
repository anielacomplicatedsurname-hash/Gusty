import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
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
  }

  return NextResponse.redirect(
    signInDestination(searchParams.get("next"), ok, brand.siteUrl, `/${defaultLocale}/projects`),
  );
}
