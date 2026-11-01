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

describe("logging a refused check", () => {
  it("says why and whether a token was sent, never the token itself", async () => {
    const { logCaptchaRefusal } = await import("@/lib/captcha");
    const lines: string[] = [];
    const warn = console.warn;
    console.warn = (line: string) => lines.push(line);
    try {
      const form = new FormData();
      logCaptchaRefusal("idea", form, { code: "captcha_failed", message: "captcha protection: request disallowed (no captcha response)" });
      form.set(CAPTCHA_FIELD, "secret.one.time.token");
      logCaptchaRefusal("idea", form, { code: "captcha_failed", message: "captcha protection: request disallowed (invalid-input-response)" });
    } finally {
      console.warn = warn;
    }
    expect(lines[0]).toBe("Bot check refused (idea): captcha_failed: captcha protection: request disallowed (no captcha response) · token missing");
    expect(lines[1]).toContain("token sent (21 characters)");
    expect(lines.join(" ")).not.toContain("secret.one.time.token");
  });
});
