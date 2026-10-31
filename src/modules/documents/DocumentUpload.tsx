"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type en from "@/i18n/messages/en.json";
import type { DocumentError } from "@/app/api/documents/route";

type Copy = typeof en.documents;

/** Choose a PDF and let Gusty read it: into a new project, or into this one. */
export function DocumentUpload({ projectId, lang, copy }: { projectId?: string; lang: string; copy: Copy }) {
  const router = useRouter();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("lang", lang);
    if (projectId) form.set("projectId", projectId);
    try {
      const response = await fetch("/api/documents", { method: "POST", body: form });
      const result = (await response.json()) as { ok: true; projectId: string } | { ok: false; error: DocumentError };
      if (!result.ok) return setError(copy.errors[result.error] ?? copy.errors.error);
      if (projectId) {
        setDone(true);
        setFile(null);
        router.refresh();
      } else router.push(`/${lang}/projects/${result.projectId}`);
    } catch {
      setError(copy.errors.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <div>
        <label htmlFor={id} className="block font-medium">{copy.fileLabel}</label>
        <p id={`${id}-hint`} className="text-sm text-text-muted">{copy.fileHint} {copy.limitNote}</p>
        <input id={id} type="file" accept="application/pdf,.pdf" aria-describedby={`${id}-hint`} disabled={busy}
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDone(false); setError(null); }}
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border file:border-ink file:bg-paper file:px-4 file:py-2 file:font-medium" />
      </div>
      <button type="button" className="btn-primary self-start" disabled={!file || busy} onClick={send}>
        {projectId ? copy.readAdd : copy.readNew}
      </button>
      {busy && (
        <p role="status" className="flex items-center gap-3 text-text-muted">
          <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full bg-lilac motion-safe:animate-pulse" />
          {copy.reading}
        </p>
      )}
      {done && <p role="status" className="rounded-xl bg-confirmed/60 p-3 text-ink">{copy.added}</p>}
      {error && <p role="alert" className="font-medium">{error}</p>}
      <p className="text-sm text-text-muted">{copy.privacy}</p>
    </div>
  );
}
