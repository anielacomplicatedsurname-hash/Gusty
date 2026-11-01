"use client";

import { Dictate } from "@/components/Dictate";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { bracketsIn, countWords, parseLimit, type Gap } from "@/ai/tasks/draft-answer";
import { fill } from "@/i18n/format";
import type en from "@/i18n/messages/en.json";
import { draftAnswer, improveAnswer, saveAnswer } from "./answers";
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
  // Filling a [placeholder] in from the list saves the answer; its card then starts again from the saved text.
  const [filled, setFilled] = useState<Record<string, { n: number; text: string; base?: string }>>({});
  const onFilled = (key: string, text: string) =>
    setFilled((f) => ({ ...f, [key]: { n: (f[key]?.n ?? 0) + 1, text, base: byKey.get(key)?.updatedAt } }));
  // Until the page catches up after a fill, the list works from the newest text, so quick fills don't clash.
  const latest = (key: string) => {
    const f = filled[key];
    return f && f.base === byKey.get(key)?.updatedAt ? f.text : byKey.get(key)?.answer ?? "";
  };
  // Fills for the same answer build on each other and save in order, even if the person presses "Fill in"
  // again before the last one has saved: otherwise the second save would start from the old text.
  const inFlight = useRef<Record<string, { text: string; chain: Promise<unknown> }>>({});
  const fillIn = async (key: string, placeholder: string, value: string): Promise<boolean> => {
    const current = inFlight.current[key];
    const next = (current?.text ?? latest(key)).replace(placeholder, value);
    const save = (current?.chain ?? Promise.resolve()).catch(() => undefined).then(() => saveAnswer(appId, key, next));
    inFlight.current[key] = { text: next, chain: save };
    const { ok } = await save;
    if (inFlight.current[key]?.text === next) delete inFlight.current[key];
    if (ok) onFilled(key, next);
    return ok;
  };
  const [openKey, setOpenKey] = useState<string | null>(() => (questions.find((q) => !byKey.get(q.key)?.answer) ?? questions[0])?.key ?? null);

  const download = () => {
    const text = [
      fill(copy.fileHeading, { title }), "",
      ...questions.flatMap((q, i) => [`${i + 1}. ${q.question}${q.limit ? ` (${q.limit})` : ""}`, "", byKey.get(q.key)?.answer || "–", "", ""]),
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
        <h2 id="answers-title" className="type-heading">{copy.answersTitle}</h2>
        <p className="mt-1 text-sm text-text-muted">{copy.answersIntro}</p>
      </div>
      {questions.length === 0 ? (
        <p className="text-text-muted">{copy.answersNone}</p>
      ) : (
        <>
          <FillIn questions={questions} answerOf={latest} fillIn={fillIn} copy={copy} />
          <ol className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <li key={q.key}>
                <AnswerCard key={filled[q.key]?.n ?? 0} filledText={filled[q.key]?.text} number={i + 1} appId={appId} question={q} saved={byKey.get(q.key)} demo={demo} lang={lang} copy={copy}
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

function AnswerCard({ number, appId, question, saved, demo, lang, copy, expanded, onToggle, filledText }: {
  number: number; appId: string; question: Question; saved?: Answer; demo: boolean; lang: string; copy: Copy;
  expanded: boolean; onToggle: () => void; filledText?: string;
}) {
  const id = useId();
  const router = useRouter();
  const [text, setText] = useState(filledText ?? saved?.answer ?? "");
  const [source, setSource] = useState<"ai" | "user">(filledText !== undefined ? "user" : saved?.source ?? "user");
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
  const [improving, startImprove] = useTransition();
  const [before, setBefore] = useState<string | null>(null);

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
  const improve = () =>
    startImprove(async () => {
      setError(null);
      const previous = text;
      const result = await improveAnswer(appId, question.key, text, lang, style);
      if (!result.ok) return setError(copy.draftErrors[result.error]);
      setBefore(previous);
      setText(result.answer);
      setGaps(result.gaps);
      setFunderWords(result.funderWords);
      setSource("ai");
      setDirty(false);
      router.refresh();
    });
  const undoImprove = () => {
    if (before === null) return;
    setText(before);
    setBefore(null);
    setDirty(true);
  };
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

      {(drafting || improving) && (
        <p role="status" className="flex items-center gap-3 text-text-muted">
          <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full bg-lilac motion-safe:animate-pulse" />
          {improving ? copy.improving : copy.drafting}
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
          <HighlightedTextarea id={`${id}-a`} value={text} disabled={drafting || improving} describedBy={`${id}-count`}
            onChange={(v) => { setText(v); setDirty(true); setCopied(false); }} />
          <Dictate target={`${id}-a`} disabled={drafting || improving} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p id={`${id}-count`} className={over ? "font-semibold" : "text-text-muted"}>{counter}</p>
            <p className="text-text-muted">{dirty ? copy.unsaved : before !== null ? copy.improved : source === "ai" ? copy.gustysDraft : text ? copy.yourAnswer : ""}</p>
          </div>
          {bracketsIn(text).length > 0 && <p className="rounded-xl bg-fill-in p-3 text-sm text-ink">{copy.brackets}</p>}
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
            {text.trim() && (
              <button type="button" className="text-sm font-medium underline underline-offset-4" disabled={drafting || saving || improving}
                aria-describedby={`${id}-improve`} onClick={improve}>
                {copy.improve}
              </button>
            )}
            {before !== null && (
              <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={undoImprove}>{copy.undoImprove}</button>
            )}
            <button type="button" className="text-sm font-medium underline underline-offset-4" disabled={drafting || saving || improving}
              aria-describedby={`${id}-again`} onClick={draft}>
              {text ? copy.draftAgain : copy.draft}
            </button>
            <span id={`${id}-again`} className="sr-only">{copy.draftAgainHint}</span>
            <span id={`${id}-improve`} className="sr-only">{copy.improveHint}</span>
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

/**
 * The answer box, with anything still [in brackets] highlighted in pale yellow. The highlight sits behind a
 * transparent textarea and scrolls with it, so typing works exactly as normal.
 */
function HighlightedTextarea({ id, value, disabled, describedBy, onChange }: {
  id: string; value: string; disabled: boolean; describedBy: string; onChange: (value: string) => void;
}) {
  const back = useRef<HTMLDivElement>(null);
  const parts = value.split(/(\[[^\]\n]{1,160}\])/g);
  const shared = "whitespace-pre-wrap break-words p-3 leading-relaxed [scrollbar-gutter:stable]";
  return (
    <div className="relative rounded-xl bg-paper">
      <div ref={back} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-transparent text-transparent ${shared}`}>
        {parts.map((part, i) => (i % 2 === 1 ? <mark key={i} className="rounded-sm bg-fill-in text-transparent">{part}</mark> : <span key={i}>{part}</span>))}
        {"\n"}
      </div>
      <textarea id={id} value={value} rows={8} disabled={disabled} aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => { if (back.current) back.current.scrollTop = e.currentTarget.scrollTop; }}
        className={`relative block w-full resize-y rounded-xl border border-stone bg-transparent ${shared}`} />
    </div>
  );
}

/** Every [placeholder] across the saved answers, in one place, each filled in with one small box. */
function FillIn({ questions, answerOf, fillIn, copy }: {
  questions: Question[]; answerOf: (key: string) => string;
  fillIn: (key: string, placeholder: string, value: string) => Promise<boolean>; copy: Copy;
}) {
  const items = questions.flatMap((q, i) =>
    bracketsIn(answerOf(q.key)).map((placeholder, n) => ({ q, number: i + 1, placeholder, n })));
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="fill-in-title" className="flex flex-col gap-3 rounded-xl bg-fill-in p-4 text-ink">
      <div>
        <h3 id="fill-in-title" className="font-semibold">{copy.fillInTitle} ({items.length})</h3>
        <p className="text-sm">{copy.fillInIntro}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={`${item.q.key}-${item.n}`}>
            <FillInItem number={item.number} placeholder={item.placeholder}
              fill={(value) => fillIn(item.q.key, item.placeholder, value)} copy={copy} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FillInItem({ number, placeholder, fill: fillPlaceholder, copy }: {
  number: number; placeholder: string; fill: (value: string) => Promise<boolean>; copy: Copy;
}) {
  const id = useId();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <form className="flex flex-col gap-1" onSubmit={(e) => {
      e.preventDefault();
      if (!value.trim()) return;
      start(async () => {
        if (!(await fillPlaceholder(value.trim()))) return setFailed(true);
        setValue("");
        router.refresh();
      });
    }}>
      <label htmlFor={id} className="text-sm">
        <span className="font-semibold">{fill(copy.fillInQuestion, { n: String(number) })}:</span>{" "}
        <span className="sr-only">{fill(copy.fillInLabel, { placeholder })}</span>
        <span aria-hidden="true">{placeholder}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <input id={id} value={value} onChange={(e) => setValue(e.target.value)} maxLength={500}
          className="h-11 min-w-0 flex-1 rounded-xl border border-stone bg-paper px-3" />
        <button type="submit" className="btn-secondary min-h-11" disabled={pending || !value.trim()}>{copy.fillInButton}</button>
      </div>
      {failed && <p role="alert" className="text-sm font-medium">{copy.saveError}</p>}
    </form>
  );
}
