"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { fill } from "@/i18n/format";
import type en from "@/i18n/messages/en.json";
import { describeVoice, saveVoice } from "./actions";
import type { Voice } from "./data";

type Copy = typeof en.bank;

/** How the person writes, so later drafts sound like them. Gusty describes it; the person can change it. */
export function VoiceSection({ voice, ownWords, minWords, demo, projectId, lang, copy }: {
  voice: Voice | null; ownWords: number; minWords: number; demo: boolean; projectId: string; lang: string; copy: Copy;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(voice?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const enough = ownWords >= minWords;

  const describe = () =>
    start(async () => {
      setError(null);
      const result = await describeVoice(projectId, lang);
      if (result.ok) router.refresh();
      else setError(copy.voiceErrors[result.error]);
    });

  return (
    <section aria-labelledby="voice-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <div className="flex items-center gap-3">
          <BrandSymbol name="open-hands" size={28} />
          <h2 id="voice-title" className="text-xl font-semibold">{copy.voiceTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">{copy.voiceIntro}</p>
      </div>

      {editing ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const { ok } = await saveVoice(projectId, draft);
            if (ok) { setEditing(false); router.refresh(); } else setError(copy.voiceErrors.error);
          });
        }}>
          <label htmlFor="voice-text" className="font-medium">{copy.voiceLabel}</label>
          <textarea id="voice-text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1200} rows={6}
            className="w-full rounded-xl border border-stone bg-paper p-3" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={pending || !draft.trim()}>{copy.save}</button>
            <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setEditing(false)}>{copy.cancel}</button>
          </div>
        </form>
      ) : voice ? (
        <div className="flex flex-col gap-2">
          {demo && voice.source === "ai" && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.voiceDemoNotice}</p>}
          <p className="whitespace-pre-line rounded-xl bg-paper p-4">{voice.description}</p>
          <p className="text-sm text-text-muted">{voice.source === "user" ? copy.voiceYours : copy.voiceFromGusty}</p>
          <div className="flex flex-wrap items-center gap-x-4 text-sm font-medium">
            <button type="button" className="min-h-6 underline underline-offset-4" disabled={pending}
              onClick={() => { setDraft(voice.description); setEditing(true); }}>{copy.voiceEdit}</button>
            {enough && (
              <button type="button" className="min-h-6 underline underline-offset-4" disabled={pending} onClick={describe}>
                {pending ? copy.voiceDescribing : copy.voiceDescribeAgain}
              </button>
            )}
          </div>
        </div>
      ) : enough ? (
        <button type="button" className="btn-secondary self-start" disabled={pending} onClick={describe}>
          {pending ? copy.voiceDescribing : copy.voiceDescribe}
        </button>
      ) : (
        <p className="text-text-muted">{fill(copy.voiceTooShort, { n: String(ownWords), min: String(minWords) })}</p>
      )}
      {error && <p role="alert" className="font-medium">{error}</p>}
    </section>
  );
}
