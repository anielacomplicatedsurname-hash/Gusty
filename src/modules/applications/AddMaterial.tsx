"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MATERIAL_KINDS } from "@/ai/tasks/funder-material";
import type en from "@/i18n/messages/en.json";
import type { MaterialUploadError } from "@/app/api/applications/material/route";
import { addLink, addPasted, removeMaterial } from "./actions";

type Copy = typeof en.applications;
const WAYS = ["pdf", "paste", "link"] as const;

/** Bring in one of the funder's papers: upload a PDF, paste the text, or give a public link. */
export function AddMaterial({ appId, lang, copy }: { appId: string; lang: string; copy: Copy }) {
  const router = useRouter();
  const [kind, setKind] = useState<string>("form");
  const [way, setWay] = useState<(typeof WAYS)[number]>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const ready = way === "pdf" ? !!file : way === "paste" ? !!text.trim() : !!url.trim();
  const read = () =>
    start(async () => {
      setError(null);
      setDone(false);
      let result: { ok: true } | { ok: false; error: MaterialUploadError | "empty" | "link" | "tooLong" };
      if (way === "pdf") {
        const form = new FormData();
        form.set("file", file!);
        form.set("applicationId", appId);
        form.set("kind", kind);
        form.set("lang", lang);
        try {
          result = await (await fetch("/api/applications/material", { method: "POST", body: form })).json();
        } catch {
          result = { ok: false, error: "error" };
        }
      } else if (way === "paste") result = await addPasted(appId, kind, text, lang);
      else result = await addLink(appId, kind, url, lang);
      if (!result.ok) return setError(copy.errors[result.error] ?? copy.errors.error);
      setDone(true);
      setFile(null);
      setText("");
      setUrl("");
      router.refresh();
    });

  return (
    <section aria-labelledby="add-title" className="flex flex-col gap-4 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6" aria-busy={pending}>
      <div>
        <h2 id="add-title" className="text-xl font-semibold">{copy.addTitle}</h2>
        <p className="mt-1 text-sm text-text-muted">{copy.addIntro}</p>
      </div>
      <div>
        <label htmlFor="material-kind" className="block font-medium">{copy.kindLabel}</label>
        <select id="material-kind" value={kind} onChange={(e) => setKind(e.target.value)} disabled={pending}
          className="mt-1 h-11 w-full rounded-xl border border-stone bg-paper px-3">
          {MATERIAL_KINDS.map((k) => <option key={k} value={k}>{copy.kinds[k]}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="font-medium">{copy.waysLabel}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WAYS.map((w) => (
            <label key={w} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 ${way === w ? "border-ink bg-oat" : "border-stone"}`}>
              <input type="radio" name="material-way" value={w} checked={way === w} onChange={() => setWay(w)} disabled={pending} />
              {copy.ways[w]}
            </label>
          ))}
        </div>
      </fieldset>
      {way === "pdf" && (
        <div>
          <label htmlFor="material-file" className="block font-medium">{copy.fileLabel}</label>
          <p id="material-file-hint" className="text-sm text-text-muted">{copy.fileHint} {copy.limitNote}</p>
          <input id="material-file" type="file" accept="application/pdf,.pdf" aria-describedby="material-file-hint" disabled={pending}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border file:border-ink file:bg-paper file:px-4 file:py-2 file:font-medium" />
        </div>
      )}
      {way === "paste" && (
        <div>
          <label htmlFor="material-text" className="block font-medium">{copy.pasteLabel}</label>
          <p id="material-text-hint" className="text-sm text-text-muted">{copy.pasteHint} {copy.limitNote}</p>
          <textarea id="material-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} disabled={pending}
            aria-describedby="material-text-hint" className="mt-1 w-full rounded-xl border border-stone bg-paper p-3" />
        </div>
      )}
      {way === "link" && (
        <div>
          <label htmlFor="material-url" className="block font-medium">{copy.linkLabel}</label>
          <p id="material-url-hint" className="text-sm text-text-muted">{copy.linkHint} {copy.limitNote}</p>
          <input id="material-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000}
            placeholder="https://" aria-describedby="material-url-hint" disabled={pending}
            className="mt-1 h-11 w-full rounded-xl border border-stone bg-paper px-3" />
        </div>
      )}
      <button type="button" className="btn-primary self-start" disabled={!ready || pending} onClick={read}>{copy.read}</button>
      {pending && (
        <p role="status" className="flex items-center gap-3 text-text-muted">
          <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full bg-lilac motion-safe:animate-pulse" />
          {copy.reading}
        </p>
      )}
      {done && <p role="status" className="rounded-xl bg-confirmed/60 p-3 text-ink">{copy.added}</p>}
      {error && <p role="alert" className="font-medium">{error}</p>}
    </section>
  );
}

export function RemoveMaterial({ id, label, lang, copy }: { id: string; label: string; lang: string; copy: Copy }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="min-h-6 text-sm font-medium underline underline-offset-4" disabled={pending}
      aria-label={`${copy.remove}: ${label}`}
      onClick={() => start(async () => { await removeMaterial(id, lang); router.refresh(); })}>
      {copy.remove}
    </button>
  );
}
