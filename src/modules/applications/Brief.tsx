import type { Messages } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import type { Material } from "./data";
import { keyOf } from "./questions";

type Copy = Messages["applications"];

type Found = { m: Material; page: string };

/** A paper's short name: the file name, "Pasted text", or a link's website. */
function paperName(m: Material, copy: Copy): string {
  if (m.origin === "paste") return copy.pasted;
  if (m.origin === "link") {
    try {
      const u = new URL(m.url || m.label);
      return `${u.hostname.replace(/^www\./, "")}${u.pathname.length > 1 ? u.pathname.slice(0, 30) : ""}`;
    } catch {
      return m.label;
    }
  }
  return m.label;
}

/** Where an item came from: every paper that says it, with the page for a PDF. */
function Sources({ found, copy }: { found: Found[]; copy: Copy }) {
  const label = found.map(({ m, page }) => `${paperName(m, copy)}${page ? ` (${fill(copy.page, { n: page })})` : ""}`).join(", ");
  return <span className="block text-xs text-text-muted">{fill(copy.from, { label })}</span>;
}


/**
 * The same question or rule often appears in more than one paper (the form and the guidance): show it once,
 * with every paper it came from.
 */
function merge<T extends { page: string }>(materials: Material[], pick: (m: Material) => T[], key: (item: T) => string) {
  const out = new Map<string, { item: T; found: Found[] }>();
  for (const m of materials) {
    for (const item of pick(m)) {
      const k = keyOf(key(item));
      const existing = out.get(k);
      if (existing) existing.found.push({ m, page: item.page });
      else out.set(k, { item, found: [{ m, page: item.page }] });
    }
  }
  return [...out.values()];
}

/** What the funder is looking for, read from all their papers and quoted as they put it. */
export function Brief({ materials, copy }: { materials: Material[]; copy: Copy }) {
  const questions = merge(materials, (m) => m.reading.questions ?? [], (q) => q.question);
  const priorities = merge(materials, (m) => m.reading.priorities ?? [], (p) => p.phrase);
  const rules = merge(materials, (m) => m.reading.rules ?? [], (r) => `${r.kind} ${r.text}`);
  const details = merge(materials, (m) => m.reading.details ?? [], (d) => `${d.label} ${d.value}`);
  const winners = merge(materials, (m) => m.reading.winners ?? [], (w) => w.name);
  const tones = merge(materials, (m) => (m.reading.tone ? [{ tone: m.reading.tone, page: "" }] : []), (t) => t.tone);
  const demo = materials.some((m) => m.reading.demo);

  return (
    <section aria-labelledby="brief-title" className="flex flex-col gap-5 rounded-(--radius-card) bg-surface-raised p-5 sm:p-6">
      <div>
        <h2 id="brief-title" className="text-xl font-semibold">{copy.briefTitle}</h2>
        <p className="mt-1 text-sm text-text-muted">{copy.briefIntro}</p>
      </div>
      {materials.length === 0 ? (
        <p className="text-text-muted">{copy.nothingYet}</p>
      ) : (
        <>
          {demo && <p className="rounded-xl bg-sky p-3 text-sm text-ink">{copy.demoReadingNotice}</p>}
          {questions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.questionsTitle}</h3>
              <ol className="mt-2 flex list-decimal flex-col gap-3 pl-6">
                {questions.map(({ item: q, found }, i) => (
                  <li key={i}>
                    <p className="font-medium">{q.question}</p>
                    {q.limit && <p className="text-sm">{fill(copy.limit, { limit: q.limit })}</p>}
                    {q.help && <p className="text-sm text-text-muted">{q.help}</p>}
                    <Sources found={found} copy={copy} />
                  </li>
                ))}
              </ol>
            </div>
          )}
          {priorities.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.prioritiesTitle}</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {priorities.map(({ item: p, found }, i) => (
                  <li key={i}>
                    <p className="font-medium">“{p.phrase}”</p>
                    {p.meaning && <p className="text-sm">{p.meaning}</p>}
                    <Sources found={found} copy={copy} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rules.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.rulesTitle}</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {rules.map(({ item: r, found }, i) => (
                  <li key={i}>
                    <p><span className="type-label mr-2 text-text-muted">{copy.ruleKinds[r.kind]}</span>{r.text}</p>
                    <Sources found={found} copy={copy} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {details.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.detailsTitle}</h3>
              <dl className="mt-2 flex flex-col gap-2">
                {details.map(({ item: d, found }, i) => (
                  <div key={i}>
                    <dt className="text-sm font-semibold">{d.label}</dt>
                    <dd>{d.value} <Sources found={found} copy={copy} /></dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {winners.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.winnersTitle}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {winners.map(({ item: w, found }, i) => (
                  <li key={i}><span className="font-medium">{w.name}</span>{w.what ? `: ${w.what}` : ""} <Sources found={found} copy={copy} /></li>
                ))}
              </ul>
            </div>
          )}
          {tones.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold">{copy.toneTitle}</h3>
              {tones.map(({ item: t, found }, i) => <p key={i} className="mt-1">{t.tone} <Sources found={found} copy={copy} /></p>)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
