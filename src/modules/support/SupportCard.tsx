"use client";

import { useState } from "react";
import type { SupportChoices } from "@/config/support";

type Copy = {
  title: string;
  body: string;
  lift: string;
  frequency: string;
  oneOff: string;
  monthly: string;
  perMonth: string;
  other: string;
  note: string;
  manage: string;
};

/** "Help Gusty take off!": a calm, optional way to support Gusty through Stripe. No pressure, no totals. */
export function SupportCard({ choices, copy, lang }: { choices: SupportChoices; copy: Copy; lang: string }) {
  const [frequency, setFrequency] = useState<"oneOff" | "monthly">("oneOff");
  const options = frequency === "monthly" ? choices.monthly : choices.oneOff;
  const money = (n: number) =>
    new Intl.NumberFormat(lang, { style: "currency", currency: choices.currency, maximumFractionDigits: 0 }).format(n);
  const label = (amount: number | "other") =>
    amount === "other" ? copy.other : frequency === "monthly" ? copy.perMonth.replace("{amount}", money(amount)) : money(amount);

  return (
    <section aria-labelledby="support-title" className="rounded-(--radius-card) bg-surface-raised p-6 sm:p-8">
      <h2 id="support-title" className="text-2xl font-semibold">
        {copy.title}
      </h2>
      <p className="mt-2 text-text-muted">{copy.body}</p>

      {choices.monthly.length > 0 && (
        <fieldset className="mt-6">
          <legend className="text-sm font-medium">{copy.frequency}</legend>
          <div className="mt-2 inline-flex rounded-full bg-oat p-1">
            {(["oneOff", "monthly"] as const).map((value) => (
              <label
                key={value}
                className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
              >
                <input
                  type="radio"
                  name="support-frequency"
                  value={value}
                  checked={frequency === value}
                  onChange={() => setFrequency(value)}
                  className="sr-only"
                />
                {copy[value]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="mt-6 flex items-center gap-2 font-medium">
        {copy.lift}
        <WindIcon />
      </p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {options.map((option) => (
          <li key={String(option.amount)}>
            <a href={option.href} className={option.amount === 5 ? "btn-primary" : "btn-secondary"}>
              {label(option.amount)}
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-sm text-text-muted">{copy.note}</p>
      {frequency === "monthly" && choices.manage && (
        <p className="mt-2 text-sm">
          <a href={choices.manage} className="underline underline-offset-4">
            {copy.manage}
          </a>
        </p>
      )}
    </section>
  );
}

/** A simple "wind" mark (Lucide, ISC licence): a little lift. */
function WindIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
      <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
      <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
    </svg>
  );
}
