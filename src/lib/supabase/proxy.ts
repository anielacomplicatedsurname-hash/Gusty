import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

/**
 * Refreshes the Supabase session cookie on navigation so Server Components see a
 * valid session. Skipped entirely for visitors who have never signed in.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  const config = supabaseConfig();
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!config || !hasSession) return response;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
