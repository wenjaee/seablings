"use client";

import { useState } from "react";

import { CRITERIA_QUESTIONS } from "@/lib/planner/contract";
import type { CriteriaResponse } from "@/lib/planner/types";

const OPTION_LABELS = ["A", "B", "C"];

export function CriteriaDialog({ onSubmit }: { onSubmit: (response: CriteriaResponse) => void }) {
  const [step, setStep] = useState(0);
  const [availability, setAvailability] = useState("");
  const [budget, setBudget] = useState("");
  const [vetoes, setVetoes] = useState<string[]>([]);
  const [vetoFreeText, setVetoFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const question = CRITERIA_QUESTIONS[step];
  const isLast = step === CRITERIA_QUESTIONS.length - 1;

  const singleValue = question.id === "availability" ? availability : budget;
  const setSingleValue = question.id === "availability" ? setAvailability : setBudget;

  const canAdvance = question.id === "vetoes" ? true : singleValue.trim().length > 0;

  function toggleVeto(option: string) {
    setVetoes((prev) => (prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]));
  }

  function handleNext() {
    if (!canAdvance || submitting) {
      return;
    }
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    setSubmitting(true);
    const trimmedFreeText = vetoFreeText.trim();
    onSubmit({
      availability,
      budget,
      vetoes: trimmedFreeText ? [...vetoes, trimmedFreeText] : vetoes
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
        {question.options.map((option, index) => {
          const selected =
            question.id === "vetoes" ? vetoes.includes(option) : singleValue === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => (question.id === "vetoes" ? toggleVeto(option) : setSingleValue(option))}
              className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-[15px] font-semibold transition-colors"
              style={{
                background: selected ? "var(--zx-brand-soft)" : "var(--zx-surface)",
                color: "var(--zx-ink)"
              }}
            >
              <span
                className="grid h-6 w-7 shrink-0 place-items-center rounded-md text-[12px] font-bold"
                style={{
                  background: selected ? "var(--zx-brand)" : "var(--zx-line)",
                  color: selected ? "var(--zx-brand-deep)" : "var(--zx-muted)"
                }}
              >
                {OPTION_LABELS[index]}
              </span>
              {option}
            </button>
          );
        })}

        {/* Free-text option (D) */}
        {question.id === "vetoes" ? (
          <FreeTextRow value={vetoFreeText} onChange={setVetoFreeText} placeholder={question.freeTextPlaceholder} />
        ) : (
          <FreeTextRow
            value={question.options.includes(singleValue) ? "" : singleValue}
            onChange={setSingleValue}
            placeholder={question.freeTextPlaceholder}
          />
        )}
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

function FreeTextRow({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const active = value.trim().length > 0;
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
      style={{
        background: active ? "var(--zx-brand-soft)" : "var(--zx-surface)"
      }}
    >
      <span
        className="grid h-6 w-7 shrink-0 place-items-center rounded-md text-[12px] font-bold"
        style={{
          background: active ? "var(--zx-brand)" : "var(--zx-line)",
          color: active ? "var(--zx-brand-deep)" : "var(--zx-muted)"
        }}
      >
        D
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--zx-ink)] outline-none placeholder:font-semibold placeholder:text-[var(--zx-muted)]"
      />
    </div>
  );
}
