"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Speak instead of type, in any Gusty text box. Uses the browser's own speech recognition (the
 * Web Speech API), so there's no library, no cost and Gusty never receives the recording: the browser's
 * speech service (for example Google's in Chrome, Apple's in Safari) turns it into words, which land in
 * the box like typing. Where the browser can't do it (Firefox, for now) the button doesn't show.
 * The first time, people are told who hears their voice before the microphone starts.
 */

export type DictationCopy = {
  start: string;
  stop: string;
  listening: string;
  consentTitle: string;
  consentBody: string;
  consentOk: string;
  consentCancel: string;
  errors: { blocked: string; noSpeech: string; failed: string };
};

const CopyContext = createContext<DictationCopy | null>(null);

export function DictationProvider({ copy, children }: { copy: DictationCopy; children: ReactNode }) {
  return <CopyContext.Provider value={copy}>{children}</CopyContext.Provider>;
}

// The parts of the Web Speech API Gusty uses (not yet in TypeScript's DOM types).
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};
/** False on the server and in browsers without speech recognition, so nothing renders there. */
const useSupported = () => useSyncExternalStore(noop, () => recognitionClass() !== null, () => false);

const CONSENT_KEY = "gusty-dictation-ok";
const consented = () => {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
};
const rememberConsent = () => {
  try {
    window.localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    // Private windows can refuse storage: then we simply ask again next time.
  }
};

/** Puts words into a (React-controlled or plain) textarea as if typed, at the cursor, within its limit. */
export function insertText(box: HTMLTextAreaElement, words: string) {
  const text = words.trim();
  if (!text) return;
  const at = box.selectionEnd ?? box.value.length;
  const before = box.value.slice(0, at);
  const after = box.value.slice(at);
  const gap = before && !/\s$/.test(before) ? " " : "";
  const room = box.maxLength > 0 ? box.maxLength - box.value.length - gap.length : Infinity;
  if (room <= 0) return;
  const added = gap + text.slice(0, room);
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(box, before + added + after);
  box.setSelectionRange(before.length + added.length, before.length + added.length);
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

function speechLang() {
  const page = document.documentElement.lang || "en";
  // Prefer the person's own variant (en-GB, en-US…) when it matches the page language.
  return navigator.language?.toLowerCase().startsWith(page.toLowerCase()) ? navigator.language : page;
}

type State = "idle" | "asking" | "listening";
type Problem = keyof DictationCopy["errors"] | null;

/** A small "Dictate" button for the textarea with id `target`. */
export function Dictate({ target, disabled = false }: { target: string; disabled?: boolean }) {
  const copy = useContext(CopyContext);
  const supported = useSupported();
  const [state, setState] = useState<State>("idle");
  const [problem, setProblem] = useState<Problem>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => () => recognition.current?.stop(), []);

  if (!copy || !supported) return null;

  const box = () => document.getElementById(target) as HTMLTextAreaElement | null;

  const listen = () => {
    const Recognition = recognitionClass();
    if (!Recognition) return;
    const r = new Recognition();
    r.lang = speechLang();
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      const el = box();
      if (!el) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) insertText(el, e.results[i][0].transcript);
      }
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      setProblem(e.error === "not-allowed" || e.error === "service-not-allowed" ? "blocked" : e.error === "no-speech" ? "noSpeech" : "failed");
    };
    r.onend = () => {
      recognition.current = null;
      setState("idle");
      box()?.focus();
    };
    recognition.current = r;
    setProblem(null);
    setState("listening");
    try {
      r.start();
    } catch {
      recognition.current = null;
      setState("idle");
      setProblem("failed");
    }
  };

  const onClick = () => {
    if (state === "listening") recognition.current?.stop();
    else if (consented()) listen();
    else setState("asking");
  };

  const statusId = `${target}-dictate-status`;
  return (
    <div className="mt-2 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || state === "asking"}
        aria-pressed={state === "listening"}
        aria-describedby={statusId}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/30 px-4 text-sm font-medium disabled:opacity-55 aria-pressed:border-ink aria-pressed:bg-signal"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-4 ${state === "listening" ? "motion-safe:animate-pulse" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        {state === "listening" ? copy.stop : copy.start}
      </button>

      {state === "asking" && (
        <div role="group" aria-labelledby={`${target}-dictate-title`} className="max-w-prose rounded-xl bg-sky p-4 text-sm text-ink">
          <p id={`${target}-dictate-title`} className="font-semibold">{copy.consentTitle}</p>
          <p className="mt-1">{copy.consentBody}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary min-h-11" onClick={() => { rememberConsent(); listen(); }}>
              {copy.consentOk}
            </button>
            <button type="button" className="min-h-11 font-medium underline underline-offset-4" onClick={() => setState("idle")}>
              {copy.consentCancel}
            </button>
          </div>
        </div>
      )}

      <p id={statusId} role="status" className="text-sm text-text-muted">
        {state === "listening" ? copy.listening : problem ? copy.errors[problem] : ""}
      </p>
    </div>
  );
}
