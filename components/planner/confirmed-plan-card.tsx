import { Calendar } from "lucide-react";

import { buildGoogleCalendarUrl } from "@/lib/planner/calendar";
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

export function PlannerConfirmedPlanCard({
  winner,
  proposedTime,
  calendarUrl
}: {
  winner: ConfirmedPlanCardInput;
  proposedTime?: string;
  calendarUrl?: string;
}) {
  const label = getRecommendationLabel(winner);
  const area = getRecommendationArea(winner);
  const budgetLabel = getBudgetLabel(winner);

  const resolvedCalendarUrl = calendarUrl
    ? calendarUrl
    : buildGoogleCalendarUrl({
        title: label,
        start: new Date(),
        location: area,
        details: `SEAblings plan · ${label} in ${area}`
      });

  return (
    <div className="my-2 rounded-2xl px-4 py-3.5" style={{ background: "var(--zx-ink)" }}>
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
        href={resolvedCalendarUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[14px] font-bold text-[var(--zx-ink)]"
      >
        <Calendar size={16} />
        Add to Google Calendar
      </a>
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
