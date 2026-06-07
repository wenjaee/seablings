"use client";

import { useEffect, useMemo } from "react";

import type { RecommendationCard } from "@/lib/planner/types";

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

/** Deterministic pseudo-random in [0,1) — pure, so it's safe to use during render. */
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

export function CelebrationOverlay({
  winners,
  proposedTime,
  onDismiss
}: {
  winners: RecommendationCard[];
  proposedTime?: string;
  onDismiss: () => void;
}) {
  const pieces = useMemo(() => makeConfetti(), []);

  useEffect(() => {
    const timer = setTimeout(onDismiss, 3600);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const headline = winners.map((w) => w.name).join(" & ");
  const subline =
    winners.length === 1 ? `${winners[0].area}${proposedTime ? ` · ${proposedTime}` : ""}` : "Joint winners!";

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="absolute inset-0 z-30 grid place-items-center overflow-hidden bg-black/25 px-8"
      aria-label="Dismiss celebration"
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
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[1px] text-[var(--zx-brand-deep)] opacity-80">
          You&apos;re going to
        </p>
        <p className="text-[22px] font-extrabold leading-tight text-[var(--zx-ink)]">{headline}</p>
        <p className="mt-1 text-[12px] text-[var(--zx-muted)]">{subline}</p>
      </div>
    </button>
  );
}
