import { getMessages } from "@/i18n/dictionaries";
import { captchaSiteKey } from "@/lib/captcha";
import { getCurrentUser } from "@/modules/projects/data";
import { Captcha } from "./Captcha";

/**
 * Bot protection, shown only to people who'd start a new session: visitors with no session at all, or
 * (with `guests`) also guests, for forms that send a sign-in email. Renders nothing when it isn't set up.
 * Reads the session, so render it inside <Suspense>.
 */
export async function GuestCaptcha({ lang, guests = false }: { lang: string; guests?: boolean }) {
  const siteKey = captchaSiteKey();
  if (!siteKey) return null;
  const user = await getCurrentUser();
  if (user && !(guests && user.isAnonymous)) return null;
  const t = await getMessages();
  return <Captcha siteKey={siteKey} lang={lang} note={t.captcha.note} />;
}
