import { Calendar } from "lucide-react";

import { buildGoogleCalendarUrl } from "@/lib/planner/calendar";
import type { RecommendationCard } from "@/lib/planner/types";

export function ConfirmedPlanCard({
  winner,
  proposedTime,
  proposedStartIso
}: {
  winner: RecommendationCard;
  proposedTime?: string;
  proposedStartIso?: string;
}) {
  const calendarUrl = buildGoogleCalendarUrl({
    title: winner.name,
    start: proposedStartIso ? new Date(proposedStartIso) : new Date(),
    location: winner.area,
    details: `SEAblings plan · view on Google Maps: ${winner.mapsUrl}`
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

      <p className="mb-2.5 text-[16px] font-extrabold text-white">{winner.name}</p>

      <PlanRow label="When" value={proposedTime ?? "TBC"} />
      <PlanRow label="Where" value={winner.area} />
      <PlanRow label="Budget" value={winner.budgetTier} />

      <a
        href={calendarUrl}
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

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-12 shrink-0 text-[11px] text-white/45">{label}</span>
      <span className="text-[13px] font-semibold text-white">{value}</span>
    </div>
  );
}
