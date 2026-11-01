import { afterEach, describe, expect, it } from "vitest";
import { CAPTCHA_FIELD, captchaSiteKey, captchaTokenFrom, isCaptchaError } from "@/lib/captcha";

describe("bot check helpers", () => {
  afterEach(() => {
    delete process.env.TURNSTILE_SITE_KEY;
  });

  it("is off until a site key is set", () => {
    expect(captchaSiteKey()).toBeNull();
    process.env.TURNSTILE_SITE_KEY = "  ";
    expect(captchaSiteKey()).toBeNull();
    process.env.TURNSTILE_SITE_KEY = "0x4AAA";
    expect(captchaSiteKey()).toBe("0x4AAA");
  });

  it("reads the token Turnstile puts in the form, and nothing else", () => {
    const form = new FormData();
    expect(captchaTokenFrom(form)).toBeUndefined();
    expect(captchaTokenFrom(null)).toBeUndefined();
    form.set(CAPTCHA_FIELD, " abc.def ");
    expect(captchaTokenFrom(form)).toBe("abc.def");
    form.set(CAPTCHA_FIELD, new Blob(["x"]));
    expect(captchaTokenFrom(form)).toBeUndefined();
  });

  it("recognises Supabase's captcha refusals, not other errors", () => {
    expect(isCaptchaError({ code: "captcha_failed", message: "captcha protection: request disallowed" })).toBe(true);
    expect(isCaptchaError({ message: "captcha verification process failed" })).toBe(true);
    expect(isCaptchaError({ code: "over_request_rate_limit", message: "Too many requests" })).toBe(false);
    expect(isCaptchaError(null)).toBe(false);
  });
});
