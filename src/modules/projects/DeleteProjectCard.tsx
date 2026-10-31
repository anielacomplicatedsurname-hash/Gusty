"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { fill } from "@/i18n/format";
import { deleteProjectNamed } from "./actions";

type Copy = {
  deleteFromCard: string; deleteWarning: string; deleteTypeName: string; deleteForever: string; cancel: string; deleteFailed: string;
};

/**
 * Deleting a project from My Projects, carefully: the person reads what will go, then types the project's
 * name before the button works. Nothing can be brought back afterwards.
 */
export function DeleteProjectCard({ id, title, copy }: { id: string; title: string; copy: Copy }) {
  const router = useRouter();
  const field = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const matches = typed.replace(/\s+/g, " ").trim().toLowerCase() === title.replace(/\s+/g, " ").trim().toLowerCase();

  if (!open) {
    return (
      <button type="button" className="self-start text-sm font-medium text-text-muted underline underline-offset-4 hover:text-ink"
        aria-label={`${copy.deleteFromCard}: ${title}`} onClick={() => setOpen(true)}>
        {copy.deleteFromCard}
      </button>
    );
  }
  return (
    <div role="group" aria-label={`${copy.deleteFromCard}: ${title}`} className="flex flex-col gap-3 rounded-xl border-2 border-ink p-4">
      <p className="font-medium">{fill(copy.deleteWarning, { title })}</p>
      <div>
        <label htmlFor={field} className="block text-sm font-medium">{fill(copy.deleteTypeName, { title })}</label>
        <input id={field} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false}
          className="mt-1 h-11 w-full rounded-xl border border-stone bg-paper px-3" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary min-h-11" disabled={!matches || pending}
          onClick={() => start(async () => {
            const { ok } = await deleteProjectNamed(id, typed);
            if (ok) router.refresh();
            else setFailed(true);
          })}>
          {copy.deleteForever}
        </button>
        <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => { setOpen(false); setTyped(""); }}>
          {copy.cancel}
        </button>
      </div>
      {failed && <p role="alert" className="font-medium">{copy.deleteFailed}</p>}
    </div>
  );
}
