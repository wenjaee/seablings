"use client";

import { useEffect, useMemo } from "react";

import { CalendarPlus } from "lucide-react";
import type { PlannerRecommendationCard, PlannerWinner } from "@/lib/planner/types";

type PlannerCelebrationRecommendation = PlannerWinner | PlannerRecommendationCard;

const CONFETTI_COLORS = ["#35c93c", "#ffd23f", "#ff6b6b", "#4d96ff", "#ff9f1c", "#c77dff"];
const CONFETTI_COUNT = 42;

type ConfettiPiece = {
  left: number;
  size: number;
  color: string;
  round: boolean;
  drift: number;
  spin: number;
  durationMs: number;
  delayMs: number;
};

function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const r = (k: number) => rand(i * 9.17 + k * 4.31);
    return {
      left: r(1) * 100,
      size: 6 + r(2) * 7,
      color: CONFETTI_COLORS[Math.floor(r(3) * CONFETTI_COLORS.length)],
      round: r(4) > 0.5,
      drift: (r(5) - 0.5) * 120,
      spin: 360 + r(6) * 540,
      durationMs: 2200 + r(7) * 1600,
      delayMs: r(8) * 600
    };
  });
}

function getRecommendationLabel(recommendation: PlannerCelebrationRecommendation) {
  return recommendation.name ?? recommendation.title ?? recommendation.item?.title ?? "Plan";
}

function getRecommendationArea(recommendation: PlannerCelebrationRecommendation) {
  return (
    recommendation.area ??
    recommendation.item?.neighborhood ??
    recommendation.item?.locationName ??
    "Area TBD"
  );
}

export function PlannerCelebrationOverlay({
  winners,
  proposedTime,
  onDismiss
}: {
  winners: PlannerCelebrationRecommendation[];
  proposedTime?: string;
  onDismiss: () => void;
}) {
  const pieces = useMemo(() => makeConfetti(), []);

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 3600);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const headline = winners.map((winner) => getRecommendationLabel(winner)).join(" + ");
  const subline = winners.length === 1 ? getRecommendationArea(winners[0]) : "Joint winners";

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss celebration"
      className="absolute inset-0 z-30 grid place-items-center overflow-hidden bg-black/25 px-8"
    >
      <div className="pointer-events-none absolute inset-0">
        {pieces.map((piece, index) => (
          <span
            key={index}
            className="planner-confetti absolute top-0 block"
            style={{
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              background: piece.color,
              borderRadius: piece.round ? "9999px" : "2px",
              ["--drift" as string]: `${piece.drift}px`,
              ["--spin" as string]: `${piece.spin}deg`,
              ["--dur" as string]: `${piece.durationMs}ms`,
              ["--delay" as string]: `${piece.delayMs}ms`
            }}
          />
        ))}
      </div>

      <div
        className="planner-pop-in relative w-full max-w-[280px] rounded-3xl border px-6 py-7 text-center shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
        style={{ background: "var(--zx-brand-soft)", borderColor: "var(--zx-brand)" }}
      >
        <div className="mb-2 text-[30px] tracking-[6px]">🎉 ✨ 🎊</div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[var(--zx-brand-deep)] opacity-80">
          You&apos;re going to
        </p>
        <p className="text-[22px] font-extrabold leading-tight text-[var(--zx-ink)]">{headline}</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-[var(--zx-muted)]">
          <CalendarPlus size={12} aria-hidden="true" />
          <span>{subline}</span>
          {proposedTime ? <span>· {proposedTime}</span> : null}
        </p>
      </div>
    </button>
  );
}

export { PlannerCelebrationOverlay as CelebrationOverlay };
