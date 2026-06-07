"use client";

import { useState } from "react";

import { CRITERIA_QUESTIONS } from "@/lib/planner/contract";
import type { CriteriaResponse } from "@/lib/planner/types";

export function CriteriaDialog({ onSubmit }: { onSubmit: (response: CriteriaResponse) => void }) {
  const [step, setStep] = useState(0);
  const [availability, setAvailability] = useState("");
  const [budget, setBudget] = useState(20);
  const [vetoesText, setVetoesText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const question = CRITERIA_QUESTIONS[step];
  const isLast = step === CRITERIA_QUESTIONS.length - 1;

  // Budget (slider) and vetoes (free text) are optional; availability needs a value.
  const canAdvance = question.kind === "choice" ? availability.trim().length > 0 : true;

  function handleNext() {
    if (!canAdvance || submitting) {
      return;
    }
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    setSubmitting(true);
    const trimmedVetoes = vetoesText.trim();
    onSubmit({
      availability,
      budget,
      vetoes: trimmedVetoes ? [trimmedVetoes] : []
    });
  }

  return (
    <div className="rounded-t-[28px] bg-white px-5 pb-6 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.14)]">
      <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-black/10" />

      <div className="mb-4 flex gap-1.5">
        {CRITERIA_QUESTIONS.map((q, index) => (
          <div
            key={q.id}
            className="h-1 flex-1 rounded-full"
            style={{ background: index <= step ? "var(--zx-brand)" : "var(--zx-line)" }}
          />
        ))}
      </div>

      <p className="mb-3.5 text-[17px] font-bold leading-snug text-[var(--zx-ink)]">
        {question.prompt}{" "}
        <span className="text-[var(--zx-muted)]">
          ({step + 1}/{CRITERIA_QUESTIONS.length})
        </span>
      </p>

      <div className="flex flex-col gap-2">
        {question.kind === "choice" ? (
          <>
            {question.options.map((option, index) => {
              const selected = availability === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAvailability(option)}
                  className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-[15px] font-semibold transition-colors"
                  style={{ background: selected ? "var(--zx-brand-soft)" : "var(--zx-surface)", color: "var(--zx-ink)" }}
                >
                  <OptionBadge label={LETTERS[index]} active={selected} />
                  {option}
                </button>
              );
            })}
            <FreeTextRow
              label={LETTERS[question.options.length]}
              value={question.options.includes(availability) ? "" : availability}
              onChange={setAvailability}
              placeholder={question.freeTextPlaceholder}
            />
          </>
        ) : null}

        {question.kind === "slider" ? (
          <div className="rounded-2xl bg-[var(--zx-surface)] px-4 py-5">
            <p className="mb-4 text-center text-[26px] font-extrabold text-[var(--zx-ink)]">
              {budget >= question.max ? `${question.unit}${question.max}+` : `${question.unit}${budget}`}
            </p>
            <input
              type="range"
              min={question.min}
              max={question.max}
              step={question.step}
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
              aria-label="Budget"
              className="w-full"
              style={{ accentColor: "var(--zx-brand)" }}
            />
            <div className="mt-1 flex justify-between text-[12px] font-medium text-[var(--zx-muted)]">
              <span>
                {question.unit}
                {question.min}
              </span>
              <span>
                {question.unit}
                {question.max}+
              </span>
            </div>
          </div>
        ) : null}

        {question.kind === "freetext" ? (
          <FreeTextRow value={vetoesText} onChange={setVetoesText} placeholder={question.freeTextPlaceholder} />
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleNext}
        disabled={!canAdvance || submitting}
        className="mt-4 w-full rounded-2xl py-3.5 text-[16px] font-bold transition-opacity disabled:opacity-40"
        style={{ background: "var(--zx-brand)", color: "var(--zx-ink)" }}
      >
        {isLast ? "Submit" : "Next →"}
      </button>
    </div>
  );
}

const LETTERS = ["A", "B", "C", "D"];

function OptionBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="grid h-6 w-7 shrink-0 place-items-center rounded-md text-[12px] font-bold"
      style={{
        background: active ? "var(--zx-brand)" : "var(--zx-line)",
        color: active ? "var(--zx-brand-deep)" : "var(--zx-muted)"
      }}
    >
      {label}
    </span>
  );
}

function FreeTextRow({
  value,
  onChange,
  placeholder,
  label
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  const active = value.trim().length > 0;
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
      style={{ background: active ? "var(--zx-brand-soft)" : "var(--zx-surface)" }}
    >
      {label ? <OptionBadge label={label} active={active} /> : null}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--zx-ink)] outline-none placeholder:font-semibold placeholder:text-[var(--zx-muted)]"
      />
    </div>
  );
}
