/**
 * Bot protection for the forms that start a session (a guest session, or an email sign-in link).
 * Cloudflare Turnstile runs in the browser and puts a one-time token in the form; Supabase Auth checks
 * it when CAPTCHA is switched on in the Supabase dashboard (Authentication → Attack Protection).
 * With no site key set, nothing loads and the token is simply absent.
 */

/** The hidden field Turnstile adds to the form it sits in. */
export const CAPTCHA_FIELD = "cf-turnstile-response";

/** Turnstile's public site key, or null when bot protection isn't set up. Server-only, read at request time. */
export function captchaSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY?.trim() || null;
}

export function captchaTokenFrom(form: FormData | null | undefined): string | undefined {
  const value = form?.get(CAPTCHA_FIELD);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Supabase's answer when the token is missing, used up or rejected. */
export function isCaptchaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "captcha_failed" || /captcha/i.test(error.message ?? "");
}
