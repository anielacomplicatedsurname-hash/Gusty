"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { countWords, parseLimit, type Gap } from "@/ai/tasks/draft-answer";
import { fill } from "@/i18n/format";
import type en from "@/i18n/messages/en.json";
import { draftAnswer, saveAnswer } from "./answers";
import type { Answer } from "./data";
import type { Question } from "./questions";

type Copy = typeof en.applications;

/** Every question from the funder's papers, each with an answer the person writes, or Gusty drafts with them. */
export function AnswersSection({ appId, title, questions, answers, demo, lang, copy }: {
  appId: string; title: string; questions: Question[]; answers: Answer[]; demo: boolean; lang: string; copy: Copy;
}) {
  const byKey = new Map(answers.map((a) => [a.key, a]));
  const written = questions.filter((q) => byKey.get(q.key)?.answer);
  // One question open at a time: the first without an answer, so the next thing to do is right there.
  const [openKey, setOpenKey] = useState<string | null>(() => (questions.find((q) => !byKey.get(q.key)?.answer) ?? questions[0])?.key ?? null);

  const download = () => {
    const text = [
      fill(copy.fileHeading, { title }), "",
      ...questions.flatMap((q, i) => [`${i + 1}. ${q.question}${q.limit ? ` (${q.limit})` : ""}`, "", byKey.get(q.key)?.answer || "—", "", ""]),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "answers"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="answers-title" className="flex flex-col gap-5 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <h2 id="answers-title" className="text-xl font-semibold">{copy.answersTitle}</h2>
        <p className="mt-1 text-sm text-text-muted">{copy.answersIntro}</p>
      </div>
      {questions.length === 0 ? (
        <p className="text-text-muted">{copy.answersNone}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <li key={q.key}>
                <AnswerCard number={i + 1} appId={appId} question={q} saved={byKey.get(q.key)} demo={demo} lang={lang} copy={copy}
                  expanded={openKey === q.key} onToggle={() => setOpenKey(openKey === q.key ? null : q.key)} />
              </li>
            ))}
          </ol>
          {written.length > 0 && (
            <div className="flex flex-col items-start gap-1">
              <button type="button" className="btn-secondary" onClick={download}>{copy.download}</button>
              <p className="text-sm text-text-muted">{copy.downloadHint}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AnswerCard({ number, appId, question, saved, demo, lang, copy, expanded, onToggle }: {
  number: number; appId: string; question: Question; saved?: Answer; demo: boolean; lang: string; copy: Copy;
  expanded: boolean; onToggle: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [text, setText] = useState(saved?.answer ?? "");
  const [source, setSource] = useState<"ai" | "user">(saved?.source ?? "user");
  const [gaps, setGaps] = useState<Gap[]>(saved?.gaps ?? []);
  const [style, setStyle] = useState<"funder" | "mine">(saved?.style ?? "funder");
  const [funderWords, setFunderWords] = useState<string[]>(saved?.funderWords ?? []);
  const [showWords, setShowWords] = useState(false);
  const [open, setOpen] = useState(!!saved?.answer);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafting, startDraft] = useTransition();
  const [saving, startSave] = useTransition();

  const limit = parseLimit(question.limit);
  const words = countWords(text);
  const counter = limit.words
    ? words > limit.words ? fill(copy.wordsOver, { n: String(words), max: String(limit.words), over: String(words - limit.words) })
      : fill(copy.wordsOf, { n: String(words), max: String(limit.words) })
    : limit.chars
      ? text.length > limit.chars ? fill(copy.charsOver, { n: String(text.length), max: String(limit.chars), over: String(text.length - limit.chars) })
        : fill(copy.charsOf, { n: String(text.length), max: String(limit.chars) })
      : fill(copy.words, { n: String(words) });
  const over = (limit.words && words > limit.words) || (limit.chars && text.length > limit.chars);

  const draft = () =>
    startDraft(async () => {
      setError(null);
      const result = await draftAnswer(appId, question.key, lang, style);
      if (!result.ok) return setError(copy.draftErrors[result.error]);
      setText(result.answer);
      setGaps(result.gaps);
      setFunderWords(result.funderWords);
      setSource("ai");
      setDirty(false);
      setOpen(true);
      router.refresh();
    });
  const save = () =>
    startSave(async () => {
      setError(null);
      const { ok } = await saveAnswer(appId, question.key, text);
      if (!ok) return setError(copy.saveError);
      setSource("user");
      setDirty(false);
      router.refresh();
    });

  const status = !text.trim() ? copy.status.empty : source === "ai" ? copy.status.ai : copy.status.user;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-busy={drafting}>
      <h3 id={`${id}-q`}>
        <button type="button" aria-expanded={expanded} aria-controls={`${id}-body`} onClick={onToggle}
          className="flex w-full items-start gap-3 text-left">
          <span aria-hidden="true" className={`mt-0.5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}>›</span>
          <span className="flex flex-1 flex-col gap-1">
            <span className="font-semibold">{number}. {question.question}</span>
            <span className="text-sm text-text-muted">{[status, text.trim() ? counter : question.limit].filter(Boolean).join(" · ")}</span>
          </span>
        </button>
      </h3>
      <div id={`${id}-body`} hidden={!expanded} className="flex flex-col gap-3">
      {question.help && <p className="text-sm text-text-muted">{question.help}</p>}

      {drafting && (
        <p role="status" className="flex items-center gap-3 text-text-muted">
          <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full bg-lilac motion-safe:animate-pulse" />
          {copy.drafting}
        </p>
      )}

      {!open ? (
        <>
        <StyleSwitch id={`${id}-style`} mine={style === "mine"} onChange={(mine) => setStyle(mine ? "mine" : "funder")} copy={copy} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={drafting} onClick={draft}>{copy.draft}</button>
          <button type="button" className="text-sm font-medium underline underline-offset-4" disabled={drafting} onClick={() => setOpen(true)}>{copy.writeOwn}</button>
        </div>
        </>
      ) : (
        <>
          {source === "ai" && demo && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoDraftNotice}</p>}
          <label htmlFor={`${id}-a`} className="sr-only">{fill(copy.answerLabel, { question: question.question })}</label>
          <textarea id={`${id}-a`} value={text} rows={8} disabled={drafting} aria-describedby={`${id}-count`}
            onChange={(e) => { setText(e.target.value); setDirty(true); setCopied(false); }}
            className="w-full rounded-xl border border-stone bg-paper p-3 leading-relaxed" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p id={`${id}-count`} className={over ? "font-semibold" : "text-text-muted"}>{counter}</p>
            <p className="text-text-muted">{dirty ? copy.unsaved : source === "ai" ? copy.gustysDraft : text ? copy.yourAnswer : ""}</p>
          </div>
          {/\[[^\]]+\]/.test(text) && <p className="rounded-xl bg-oat p-3 text-sm text-ink">{copy.brackets}</p>}
          {gaps.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">{copy.gapsTitle}</h4>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {gaps.map((g) => <li key={g.missing}>{g.missing}{g.suggestion && <span className="text-text-muted"> → {g.suggestion}</span>}</li>)}
              </ul>
            </div>
          )}
          {funderWords.length > 0 && (
            <div className="flex flex-col gap-2">
              <button type="button" aria-pressed={showWords} onClick={() => setShowWords(!showWords)}
                className="min-h-6 self-start text-sm font-medium underline underline-offset-4">
                {copy.showTheirWords}
              </button>
              {showWords && <TheirWords text={text} words={funderWords} copy={copy} />}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={!dirty || saving || drafting} onClick={save}>
              {saving ? copy.saving : dirty ? copy.save : copy.saved}
            </button>
            <button type="button" className="text-sm font-medium underline underline-offset-4" disabled={!text}
              onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}>
              {copied ? copy.copied : copy.copy}
            </button>
            <button type="button" className="text-sm font-medium underline underline-offset-4" disabled={drafting || saving}
              aria-describedby={`${id}-again`} onClick={draft}>
              {text ? copy.draftAgain : copy.draft}
            </button>
            <span id={`${id}-again`} className="sr-only">{copy.draftAgainHint}</span>
          </div>
          <StyleSwitch id={`${id}-style`} mine={style === "mine"} onChange={(mine) => setStyle(mine ? "mine" : "funder")} copy={copy} />
        </>
      )}
      {error && <p role="alert" className="font-medium">{error}</p>}
      </div>
    </div>
  );
}

/** "Sound more like me": off, Gusty mirrors the funder's language; on, the person's own voice leads. */
function StyleSwitch({ id, mine, onChange, copy }: { id: string; mine: boolean; onChange: (mine: boolean) => void; copy: Copy }) {
  return (
    <div className="flex items-start gap-3">
      <button type="button" role="switch" aria-checked={mine} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`}
        onClick={() => onChange(!mine)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-ink transition-colors motion-reduce:transition-none ${mine ? "bg-ink" : "bg-paper"}`}>
        <span aria-hidden="true" className={`inline-block size-4 rounded-full transition-transform motion-reduce:transition-none ${mine ? "translate-x-5 bg-paper" : "translate-x-0.5 bg-ink"}`} />
      </button>
      <span className="flex flex-col">
        <span id={`${id}-label`} className="text-sm font-medium">{copy.soundLikeMe}</span>
        <span id={`${id}-hint`} className="text-xs text-text-muted">{copy.soundLikeMeHint}</span>
      </span>
    </div>
  );
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The answer with the funder's own words highlighted, so mirroring them is visible, not guessed. */
function TheirWords({ text, words, copy }: { text: string; words: string[]; copy: Copy }) {
  const present = words.filter((w) => text.toLowerCase().includes(w.toLowerCase()));
  if (present.length === 0) return <p className="text-sm text-text-muted">{copy.theirWordsNone}</p>;
  const pattern = new RegExp(`(${[...present].sort((a, b) => b.length - a.length).map(escape).join("|")})`, "gi");
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-paper p-3">
      <p className="text-sm text-text-muted">{copy.theirWordsIntro}</p>
      <ul className="flex flex-wrap gap-2">
        {present.map((w) => <li key={w} className="rounded-full bg-signal px-2 py-0.5 text-xs font-medium text-ink">{w}</li>)}
      </ul>
      <p className="whitespace-pre-line leading-relaxed">
        {text.split(pattern).map((part, i) =>
          i % 2 === 1 ? <mark key={i} className="rounded bg-signal px-0.5 text-ink">{part}</mark> : <span key={i}>{part}</span>)}
      </p>
    </div>
  );
}
