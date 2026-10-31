"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import type en from "@/i18n/messages/en.json";
import { addEvidence, editEvidence, removeEvidence, type BankResult } from "./actions";
import type { Evidence } from "./data";
import { EVIDENCE_KINDS } from "./limits";

type Copy = typeof en.bank;

/** The person's own experience: past projects, wins, what people said, numbers. Theirs to add and change. */
export function ExperienceSection({ items, projectId, copy }: { items: Evidence[]; projectId: string; copy: Copy }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<BankResult | { ok: boolean }>, done?: () => void) =>
    start(async () => {
      setError(null);
      const result = await fn();
      if (result.ok) {
        done?.();
        router.refresh();
      } else setError("error" in result ? copy.errors[result.error] : copy.errors.error);
    });

  return (
    <section aria-labelledby="experience-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <div className="flex items-center gap-3">
          <BrandSymbol name="gathering" size={28} />
          <h2 id="experience-title" className="text-xl font-semibold">{copy.experienceTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">{copy.experienceIntro}</p>
      </div>

      {items.length === 0 && !adding && <p className="text-text-muted">{copy.emptyExperience}</p>}
      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((e) => (
            <li key={e.id} className="rounded-xl border border-border p-4">
              {editing === e.id ? (
                <EvidenceForm copy={copy} initial={e} pending={pending} submitLabel={copy.save}
                  onCancel={() => setEditing(null)}
                  onSubmit={(kind, text, url) => run(() => editEvidence(e.id, kind, text, url), () => setEditing(null))} />
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="type-label text-text-muted">{copy.kinds[e.kind]}</p>
                  <p className="whitespace-pre-line">{e.text}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="rounded-full border border-ink/30 px-2 py-0.5 text-xs font-medium">{copy.yourWords}</span>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium underline underline-offset-4">
                        {copy.link}
                      </a>
                    )}
                    <button type="button" className="min-h-6 font-medium underline underline-offset-4" disabled={pending}
                      aria-label={`${copy.edit}: ${e.text.slice(0, 60)}`} onClick={() => setEditing(e.id)}>{copy.edit}</button>
                    <button type="button" className="min-h-6 font-medium underline underline-offset-4" disabled={pending}
                      aria-label={`${copy.remove}: ${e.text.slice(0, 60)}`} onClick={() => run(() => removeEvidence(e.id))}>{copy.remove}</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="rounded-xl border border-border p-4">
          <EvidenceForm copy={copy} pending={pending} submitLabel={pending ? copy.adding : copy.add}
            onCancel={() => setAdding(false)}
            onSubmit={(kind, text, url) => run(() => addEvidence(projectId, kind, text, url), () => setAdding(false))} />
        </div>
      ) : (
        <button type="button" className="btn-secondary self-start" onClick={() => setAdding(true)}>{copy.addAnother}</button>
      )}
      {error && <p role="alert" className="font-medium">{error}</p>}
    </section>
  );
}

function EvidenceForm({ copy, initial, pending, submitLabel, onSubmit, onCancel }: {
  copy: Copy; initial?: Evidence; pending: boolean; submitLabel: string;
  onSubmit: (kind: string, text: string, url: string) => void; onCancel: () => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<string>(initial?.kind ?? "past_project");
  const [text, setText] = useState(initial?.text ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit(kind, text, url); }}>
      <div>
        <label htmlFor={`${id}-kind`} className="block font-medium">{copy.kindLabel}</label>
        <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-stone bg-paper px-3">
          {EVIDENCE_KINDS.map((k) => <option key={k} value={k}>{copy.kinds[k]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-text`} className="block font-medium">{copy.textLabel}</label>
        <p id={`${id}-hint`} className="text-sm text-text-muted">{copy.textHint}</p>
        <textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={4}
          aria-describedby={`${id}-hint`} className="mt-1 w-full rounded-xl border border-stone bg-paper p-3" />
      </div>
      <div>
        <label htmlFor={`${id}-url`} className="block font-medium">{copy.urlLabel}</label>
        <input id={`${id}-url`} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000}
          placeholder="https://" className="mt-1 h-11 w-full rounded-xl border border-stone bg-paper px-3" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending || !text.trim()}>{submitLabel}</button>
        <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={onCancel}>{copy.cancel}</button>
      </div>
    </form>
  );
}
