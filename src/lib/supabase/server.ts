import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseConfig } from "./config";
import type { Database } from "./database.types";

/** Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createSupabaseServerClient() {
  const config = supabaseConfig();
  if (!config) return null;
  // Sessions are per request (and check token expiry against the clock), so keep this
  // work out of prerendering entirely.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
