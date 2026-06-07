"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

import type { PlannerRecommendationCard, PlannerWinner } from "@/lib/planner/types";

type ConfirmedPlanCardInput = PlannerWinner | PlannerRecommendationCard;

function getRecommendationLabel(winner: ConfirmedPlanCardInput): string {
  return winner.name ?? winner.title ?? winner.item?.title ?? "Planned spot";
}

function getRecommendationArea(winner: ConfirmedPlanCardInput): string {
  return (
    winner.area ??
    winner.item?.neighborhood ??
    winner.item?.locationName ??
    "Area TBD"
  );
}

function getBudgetLabel(winner: ConfirmedPlanCardInput): string {
  return winner.budgetTier ?? "$$";
}

function getFallbackEmoji(winner: ConfirmedPlanCardInput): string {
  return winner.emoji ?? "📍";
}

export function PlannerConfirmedPlanCard({
  winner,
  proposedTime,
  calendarUrl,
  onConfirm
}: {
  winner: ConfirmedPlanCardInput;
  proposedTime?: string;
  calendarUrl?: string;
  onConfirm?: () => void;
}) {
  const label = getRecommendationLabel(winner);
  const area = getRecommendationArea(winner);
  const budgetLabel = getBudgetLabel(winner);
  const [imageFailed, setImageFailed] = useState(false);
  const hasPhotoSlot = Boolean(winner.photoUrl);
  const showPhoto = Boolean(winner.photoUrl && !imageFailed);

  return (
    <div className="my-2 overflow-hidden rounded-2xl" style={{ background: "var(--zx-ink)" }}>
      {hasPhotoSlot ? (
        <div className="relative grid h-32 w-full place-items-center bg-white/8 text-[48px]" aria-hidden>
          <span>{getFallbackEmoji(winner)}</span>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={winner.photoUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : null}
        </div>
      ) : null}

      <div className="px-4 py-3.5">
        <div className="mb-2.5 flex items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-extrabold"
          style={{ background: "var(--zx-brand)", color: "var(--zx-brand-deep)" }}
        >
          planner
        </span>
        <span className="text-[11px] text-white/55">Confirmed plan</span>
      </div>

      <p className="mb-2.5 text-[16px] font-extrabold text-white">{label}</p>

      <PlanRow label="When" value={proposedTime ?? "TBC"} />
      <PlanRow label="Where" value={area} />
      <PlanRow label="Budget" value={budgetLabel} />

      <a
        href={calendarUrl ?? "#"}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!calendarUrl}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[14px] font-bold text-[var(--zx-ink)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        <Calendar size={16} />
        Add to Phone Calendar
      </a>

      {onConfirm ? (
        <button
          type="button"
          onClick={onConfirm}
          className="mt-2.5 flex w-full items-center justify-center rounded-xl bg-[var(--zx-brand)] py-2.5 text-[14px] font-extrabold text-[var(--zx-brand-deep)]"
        >
          Confirm
        </button>
      ) : null}
      </div>
    </div>
  );
}

export { PlannerConfirmedPlanCard as ConfirmedPlanCard };

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-12 shrink-0 text-[11px] text-white/45">{label}</span>
      <span className="text-[13px] font-semibold text-white">{value}</span>
    </div>
  );
}
