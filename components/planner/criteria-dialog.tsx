"use client";

import { useMemo, useState } from "react";

import type { CriteriaSubmitPayload } from "@/lib/planner/types";

const BUDGET_MARKERS = [0, 10, 20, 30, 40];
const BUDGET_SENTINEL = 40;
const BUDGET_MAX = 40;
const BUDGET_STEP = 10;

function getBudgetLabel(value: number) {
  return value === BUDGET_SENTINEL ? ">£40" : `£${value}`;
}

function getBudgetOption(value: number) {
  return value === BUDGET_SENTINEL ? "Any budget" : `Up to ${getBudgetLabel(value)}`;
}

function makePayloadFromState({
  availabilityMode,
  availabilityCustom,
  budget
}: {
  availabilityMode: "Whenever" | "Custom";
  availabilityCustom: string;
  budget: number;
}): CriteriaSubmitPayload {
  const useCustomAvailability = availabilityMode === "Custom" && availabilityCustom.trim().length > 0;
  const availability = useCustomAvailability ? availabilityCustom.trim() : "Whenever";
  const budgetAmount = budget === BUDGET_SENTINEL ? 41 : budget;

  return {
    availability,
    availabilityMode: useCustomAvailability ? "Custom" : "Whenever",
    budgetMode: "slider",
    budgetAmount,
    budgetMax: budgetAmount,
    budgetOption: getBudgetOption(budget),
    budgetText: String(budgetAmount),
    vetoText: undefined,
    vetoes: []
  };
}

function splitVetoes(vetoText: string): string[] {
  return vetoText
    .split(/[,\n;]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 8);
}

export function PlannerCriteriaSheet({
  isSubmitting,
  error,
  onSubmit
}: {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (payload: CriteriaSubmitPayload) => void | Promise<void>;
}) {
  const [availabilityMode, setAvailabilityMode] = useState<"Whenever" | "Custom">("Whenever");
  const [availabilityCustom, setAvailabilityCustom] = useState("");
  const [budget, setBudget] = useState(BUDGET_SENTINEL);
  const [vetoesText, setVetoesText] = useState("");

  const canSubmit = useMemo(() => {
    if (availabilityMode === "Custom") {
      return availabilityCustom.trim().length > 0;
    }

    return true;
  }, [availabilityCustom, availabilityMode]);

  function submit() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    const vetoes = splitVetoes(vetoesText);
    const payload = {
      ...makePayloadFromState({
        availabilityMode,
        availabilityCustom,
        budget
      }),
      vetoText: vetoesText.trim() || undefined,
      vetoes
    };

    void Promise.resolve(onSubmit(payload));
  }

  return (
    <div className="rounded-t-[28px] bg-white px-5 pb-5 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.14)]">
      <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-black/10" />

      <p className="mb-2 text-[16px] font-extrabold leading-tight text-[var(--zx-ink)]">
        Share your criteria
      </p>

      <div className="mb-4 rounded-2xl bg-[var(--zx-surface)] px-4 py-3">
        <p className="text-[13px] font-semibold text-[var(--zx-ink)]">Availability</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAvailabilityMode("Whenever");
              setAvailabilityCustom("");
            }}
            className="rounded-xl px-3 py-2 text-[13px] font-semibold transition"
            style={{
              background: availabilityMode === "Whenever" ? "var(--zx-brand)" : "var(--zx-surface)",
              color: availabilityMode === "Whenever" ? "#fff" : "var(--zx-muted)"
            }}
          >
            Whenever
          </button>
        </div>

        <div className="mt-2">
          <input
            value={availabilityCustom}
            onFocus={() => setAvailabilityMode("Custom")}
            onChange={(event) => {
              const nextValue = event.target.value;
              setAvailabilityCustom(nextValue);
              setAvailabilityMode(nextValue.trim() ? "Custom" : "Whenever");
            }}
            aria-label="Custom availability"
            className="w-full rounded-xl bg-white px-3 py-3 text-[15px] font-semibold text-[var(--zx-ink)] outline-none placeholder:text-[var(--zx-muted)]"
          />
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-[var(--zx-surface)] px-4 py-4">
        <p className="text-[13px] font-semibold text-[var(--zx-ink)]">Budget max</p>
        <p className="mt-2 text-center text-[26px] font-extrabold leading-none text-[var(--zx-ink)]">
          {getBudgetLabel(budget)}
        </p>
        <input
          type="range"
          min={BUDGET_MARKERS[0]}
          max={BUDGET_MAX}
          step={BUDGET_STEP}
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
          aria-label="Budget slider"
          className="mt-4 h-2 w-full cursor-pointer rounded-full bg-black/10"
          style={{ accentColor: "var(--zx-brand)" }}
        />
        <div className="mt-1 flex justify-between text-[12px] font-medium text-[var(--zx-muted)]">
          {BUDGET_MARKERS.map((marker) => (
            <span key={marker}>{marker === BUDGET_SENTINEL ? ">£40" : `£${marker}`}</span>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-[var(--zx-surface)] px-4 py-3">
        <p className="text-[13px] font-semibold text-[var(--zx-ink)]">Vetoes</p>
        <textarea
          value={vetoesText}
          onChange={(event) => setVetoesText(event.target.value)}
          placeholder="Avoid any of these (optional)"
          aria-label="Vetoes"
          rows={2}
          className="mt-2 w-full resize-y rounded-xl bg-white px-3 py-2 text-[14px] leading-6 text-[var(--zx-ink)] outline-none placeholder:text-[var(--zx-muted)]"
        />
      </div>

      {error ? <p className="mt-1 text-[13px] text-[#d94c3d]">{error}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit || isSubmitting}
        className="mt-1 w-full rounded-2xl py-3.5 text-[16px] font-bold transition-opacity disabled:opacity-40"
        style={{ background: "var(--zx-brand)", color: "var(--zx-ink)" }}
      >
        {isSubmitting ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
}

export { PlannerCriteriaSheet as CriteriaDialog };
