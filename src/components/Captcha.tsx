"use client";

import { useEffect, useRef } from "react";

type Turnstile = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile, for first-time visitors only (the server decides). Usually invisible: it only
 * shows a box when Cloudflare needs the person to tick it. It puts a one-time token in the surrounding
 * form; after each submit it fetches a fresh one, so a second try works too.
 */
export function Captcha({ siteKey, lang, note }: { siteKey: string; lang: string; note: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    const form = box.current?.closest("form");
    const onSubmit = () => setTimeout(() => id && window.turnstile?.reset(id), 0);
    form?.addEventListener("submit", onSubmit);
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !box.current) return;
        id = turnstile.render(box.current, {
          sitekey: siteKey,
          language: lang,
          appearance: "interaction-only",
          "refresh-expired": "auto",
        });
      })
      .catch(() => {
        // Blocked or offline: the form still sends, and the server explains if the check is required.
      });
    return () => {
      cancelled = true;
      form?.removeEventListener("submit", onSubmit);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, lang]);

  return (
    <div className="flex flex-col gap-1">
      <div ref={box} data-testid="captcha" />
      <p className="text-xs text-text-muted">{note}</p>
    </div>
  );
}

/** The token inside a container, for forms sent with fetch rather than a form action. */
export function captchaTokenIn(el: HTMLElement | null): string | undefined {
  const input = el?.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
  return input?.value || undefined;
}
