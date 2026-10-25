/**
 * Public Supabase connection details. Both values are designed to be public;
 * data is protected by Row Level Security. Returns null when not configured so
 * the site still builds and explains that saving is unavailable.
 */
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}
