import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandSymbol } from "@/components/BrandSymbol";
import { getMessages, type Messages } from "@/i18n/dictionaries";
import { formatDateTime } from "@/i18n/format";
import { getAdminFeedback, getAdminOverview, type FeedbackItem } from "@/modules/admin/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.notFound.title, robots: { index: false, follow: false } };
}

export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const t = await getMessages();
  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
      <Suspense fallback={<p className="text-text-muted">{t.admin.loading}</p>}>
        <AdminContent params={params} t={t} />
      </Suspense>
    </section>
  );
}

const money = (n: number, lang: string) =>
  new Intl.NumberFormat(lang, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: n > 0 && n < 0.01 ? 4 : 2 }).format(n);

async function AdminContent({ params, t }: { params: PageProps<"/[lang]/admin">["params"]; t: Messages }) {
  const { lang } = await params;
  const result = await getAdminOverview();

  // Everyone who isn't an admin sees the ordinary "not found" page: the overview isn't advertised.
  if (!result.ok && result.error === "forbidden") {
    return (
      <div className="flex flex-col items-start gap-6">
        <BrandSymbol name="two-waves" size={64} />
        <h1 className="type-display text-5xl">{t.notFound.title}</h1>
        <p className="text-lg text-text-muted">{t.notFound.body}</p>
      </div>
    );
  }
  if (!result.ok) {
    return (
      <p role="alert" className="text-lg">
        {t.admin.unavailable}
      </p>
    );
  }

  const { people, projects, cost, days, tasks, errors } = result.overview;
  const feedback = await getAdminFeedback();
  const a = t.admin;
  const taskName = (task: string) => (a.tasks as Record<string, string>)[task] ?? task;
  const reasonName = (reason: string) => (a.reasons as Record<string, string>)[reason] ?? reason;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="type-display text-5xl">{a.title}</h1>
        <p className="mt-3 text-lg text-text-muted">{a.intro}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title={a.people} rows={[[a.peopleTotal, people.total], [a.peopleWithEmail, people.withEmail], [a.peopleGuests, people.guests], [a.newThisWeek, people.newThisWeek]]} />
        <Card title={a.projects} rows={[[a.projectsTotal, projects.total], [a.newThisWeek, projects.newThisWeek]]} />
        <Card title={a.cost} rows={[[a.costToday, money(cost.today, lang)], [a.costWeek, money(cost.week, lang)], [a.costMonth, money(cost.month, lang)]]} />
      </div>
      <p className="-mt-6 text-sm text-text-muted">{a.costNote}</p>

      <Feedback items={feedback} t={t} lang={lang} />

      <Table
        caption={a.byTask}
        empty={tasks.length === 0 ? a.noRuns : null}
        head={[a.feature, a.runs, a.demo, a.errors, a.costColumn]}
        rows={tasks.map((r) => [taskName(r.task), r.runs, r.demo, r.errors, money(r.cost, lang)])}
      />
      <Table
        caption={a.problems}
        empty={errors.length === 0 ? a.noProblems : null}
        head={[a.reason, a.count, a.last]}
        rows={errors.map((r) => [reasonName(r.reason), r.count, formatDateTime(r.last, lang)])}
      />
      <Table
        caption={a.byDay}
        empty={null}
        head={[a.day, a.runs, a.errors, a.costColumn]}
        rows={days.map((r) => [r.day, r.runs, r.errors, money(r.cost, lang)])}
      />
    </div>
  );
}

function Feedback({ items, t, lang }: { items: FeedbackItem[]; t: Messages; lang: string }) {
  const a = t.admin;
  return (
    <section>
      <h2 className="text-xl font-semibold">{a.feedback}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-text-muted">{a.noFeedback}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.at} className="rounded-(--radius-card) bg-surface-raised p-5">
              <p className="text-sm text-text-muted">
                {formatDateTime(item.at, lang)}
                {item.page && ` · ${a.feedbackFrom.replace("{page}", item.page)}`}
              </p>
              <dl className="mt-2 flex flex-col gap-2">
                {([[a.feedbackWorked, item.worked], [a.feedbackConfusing, item.confusing], [a.feedbackOther, item.other]] as const)
                  .filter(([, text]) => text)
                  .map(([label, text]) => (
                    <div key={label}>
                      <dt className="text-sm font-semibold">{label}</dt>
                      <dd className="whitespace-pre-line">{text}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Card({ title, rows }: { title: string; rows: [string, string | number][] }) {
  return (
    <section className="rounded-(--radius-card) bg-surface-raised p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="mt-3 flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-text-muted">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Table({ caption, head, rows, empty }: { caption: string; head: string[]; rows: (string | number)[][]; empty: string | null }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{caption}</h2>
      {empty ? (
        <p className="mt-3 text-text-muted">{empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {head.map((h, i) => (
                  <th key={h} scope="col" className={`py-2 pr-4 font-semibold ${i > 0 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row[0])} className="border-b border-border">
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" className="py-2 pr-4 font-normal">
                        {cell}
                      </th>
                    ) : (
                      <td key={i} className="py-2 pr-4 text-right tabular-nums">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
