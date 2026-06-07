"use client";

import { useRef, useState } from "react";
import { RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";

import type { PlannerRecommendationCard } from "@/lib/planner/types";

type Vote = "up" | "down";

const CARD_TINTS = ["#FFE8CC", "#E8F4FF", "#FFE8E8"];
const SWIPE_THRESHOLD = 90;
const FLY_MS = 280;

function getRecommendationName(recommendation: PlannerRecommendationCard): string {
  return (
    recommendation.name ??
    recommendation.title ??
    recommendation.item?.title ??
    "Untitled place"
  );
}

function getRecommendationArea(recommendation: PlannerRecommendationCard): string {
  return (
    recommendation.area ??
    recommendation.item?.neighborhood ??
    recommendation.item?.locationName ??
    "Area TBD"
  );
}

function getBudgetLabel(recommendation: PlannerRecommendationCard): string {
  return recommendation.budgetTier ?? "$$";
}

function getAddress(recommendation: PlannerRecommendationCard): string {
  return recommendation.address ?? "";
}

function getDistanceLabel(recommendation: PlannerRecommendationCard): string | null {
  if (recommendation.distanceLabel) {
    return recommendation.distanceLabel;
  }

  if (typeof recommendation.distanceKm === "number") {
    return `${recommendation.distanceKm.toFixed(1)} km away`;
  }

  return null;
}

function getMapsUrl(recommendation: PlannerRecommendationCard): string {
  return recommendation.mapsUrl ?? "";
}

function cardTransform(pos: number, dragX: number, leavingDir: Vote | null): string {
  if (pos === 0) {
    if (leavingDir) {
      const x = leavingDir === "up" ? 460 : -460;
      const rotate = leavingDir === "up" ? 24 : -24;
      return `translateX(${x}px) rotate(${rotate}deg)`;
    }
    return `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`;
  }

  const offset = pos * 9;
  const scale = 1 - pos * 0.05;
  return `translate(${offset}px, ${offset}px) scale(${scale}) rotate(${pos * 2}deg)`;
}

export function PlannerVotingSheet({
  proposedTime,
  recommendations,
  selectedLimit = 3,
  isSubmitting,
  error,
  onSubmit
}: {
  proposedTime?: string;
  recommendations: PlannerRecommendationCard[];
  selectedLimit?: number;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (bucketItemIds: string[]) => void | Promise<void>;
}) {
  const total = recommendations.length;
  const [cursor, setCursor] = useState(0);
  const [decisions, setDecisions] = useState<{ id: string; vote: Vote }[]>([]);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [leavingDir, setLeavingDir] = useState<Vote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startXRef = useRef(0);

  const reviewingDone = cursor >= total;
  const likedIds = decisions.filter((decision) => decision.vote === "up").map((decision) => decision.id);
  const canLike = likedIds.length < selectedLimit;

  function commit(dir: Vote) {
    if (leavingDir || reviewingDone) {
      return;
    }

    if (dir === "up" && !canLike) {
      return;
    }

    const id = recommendations[cursor]?.bucketItemId;
    if (!id) {
      return;
    }

    setLeavingDir(dir);
    window.setTimeout(() => {
      setDecisions((previous) => [...previous, { id, vote: dir }]);
      setCursor((previous) => previous + 1);
      setLeavingDir(null);
      setDragX(0);
    }, FLY_MS);
  }

  function undo() {
    if (leavingDir || cursor === 0) {
      return;
    }

    setDecisions((previous) => previous.slice(0, -1));
    setCursor((previous) => previous - 1);
    setDragX(0);
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (leavingDir) {
      return;
    }
    startXRef.current = event.clientX;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!isDragging) {
      return;
    }
    setDragX(event.clientX - startXRef.current);
  }

  function handlePointerUp(event: React.PointerEvent) {
    if (!isDragging) {
      return;
    }
    setIsDragging(false);
    const dx = event.clientX - startXRef.current;
    if (dx > SWIPE_THRESHOLD) {
      commit("up");
    } else if (dx < -SWIPE_THRESHOLD) {
      commit("down");
    } else {
      setDragX(0);
    }
  }

  function cast() {
    if (likedIds.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    void Promise.resolve(onSubmit(likedIds)).finally(() => setSubmitting(false));
  }

  return (
    <div className="rounded-t-[28px] bg-white px-5 pb-6 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.14)]">
      <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-black/10" />

      <Header proposedTime={proposedTime} />

      {reviewingDone ? (
        <Summary
          count={likedIds.length}
          selectedLimit={selectedLimit}
          names={decisions
            .filter((decision) => decision.vote === "up")
            .map((decision) => {
              const recommendation = recommendations.find((entry) => entry.bucketItemId === decision.id);
              return getRecommendationName(recommendation ?? { bucketItemId: decision.id });
            })}
          submitting={submitting || isSubmitting}
          onUndo={undo}
          onCast={cast}
          hasSelectionCap={selectedLimit > 0}
        />
      ) : (
        <>
          <div className="relative mx-auto mt-5 h-[270px] w-full">
            {recommendations.map((recommendation, index) => {
              const pos = index - cursor;
              if (pos < 0 || pos > 2) {
                return null;
              }

              return (
                <DeckCard
                  key={recommendation.bucketItemId}
                  recommendation={recommendation}
                  index={index}
                  pos={pos}
                  counter={`${index + 1}/${total}`}
                  dragX={pos === 0 ? dragX : 0}
                  isDragging={pos === 0 && isDragging}
                  leavingDir={pos === 0 ? leavingDir : null}
                  onPointerDown={pos === 0 ? handlePointerDown : undefined}
                  onPointerMove={pos === 0 ? handlePointerMove : undefined}
                  onPointerUp={pos === 0 ? handlePointerUp : undefined}
                />
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={undo}
              disabled={cursor === 0 || leavingDir !== null}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--zx-muted)] transition-opacity disabled:opacity-30"
            >
              <RotateCcw size={16} aria-hidden />
              Undo
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => commit("up")}
                disabled={leavingDir !== null || !canLike}
                aria-label="Thumbs up"
                className="grid h-10 w-10 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-50"
                style={{ background: "var(--zx-brand-soft)" }}
              >
                <ThumbsUp size={18} className="text-[var(--zx-brand-deep)]" />
              </button>
              <button
                type="button"
                onClick={() => commit("down")}
                disabled={leavingDir !== null}
                aria-label="Thumbs down"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#FDE8E8] transition-transform active:scale-95 disabled:opacity-50"
              >
                <ThumbsDown size={18} className="text-[var(--zx-danger)]" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { PlannerVotingSheet as VotingDialog };

function DeckCard({
  recommendation,
  index,
  pos,
  counter,
  dragX,
  isDragging,
  leavingDir,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: {
  recommendation: PlannerRecommendationCard;
  index: number;
  pos: number;
  counter: string;
  dragX: number;
  isDragging: boolean;
  leavingDir: Vote | null;
  onPointerDown?: (event: React.PointerEvent) => void;
  onPointerMove?: (event: React.PointerEvent) => void;
  onPointerUp?: (event: React.PointerEvent) => void;
}) {
  const transform = cardTransform(pos, dragX, leavingDir);
  const likeOpacity = Math.min(Math.max(dragX, 0) / SWIPE_THRESHOLD, 1);
  const skipOpacity = Math.min(Math.max(-dragX, 0) / SWIPE_THRESHOLD, 1);
  const mapsUrl = getMapsUrl(recommendation);
  const distanceLabel = getDistanceLabel(recommendation);
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = Boolean(recommendation.photoUrl && !imageFailed);

  return (
    <div
      className="absolute inset-x-0 top-0 select-none overflow-hidden rounded-3xl border border-[var(--zx-line)] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
      style={{
        transform,
        zIndex: 10 - pos,
        transition: isDragging ? "none" : `transform ${FLY_MS}ms ease-out`,
        touchAction: "none",
        cursor: pos === 0 ? "grab" : "default"
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="relative grid h-[170px] place-items-center text-[64px]"
        style={{ background: CARD_TINTS[index % CARD_TINTS.length] }}
      >
        <span>{recommendation.emoji ?? "📍"}</span>
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recommendation.photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
            onError={() => setImageFailed(true)}
          />
        ) : null}
        {pos === 0 ? (
          <>
            <span
              className="absolute left-3 top-3 rounded-lg border-2 px-2 py-0.5 text-[15px] font-extrabold uppercase tracking-wide"
              style={{
                color: "var(--zx-brand-deep)",
                borderColor: "var(--zx-brand-deep)",
                opacity: likeOpacity,
                transform: "rotate(-12deg)"
              }}
            >
              Like 👍
            </span>
            <span
              className="absolute right-3 top-3 rounded-lg border-2 px-2 py-0.5 text-[15px] font-extrabold uppercase tracking-wide"
              style={{
                color: "var(--zx-danger)",
                borderColor: "var(--zx-danger)",
                opacity: skipOpacity,
                transform: "rotate(12deg)"
              }}
            >
              Skip 👎
            </span>
          </>
        ) : null}
        <span className="absolute bottom-2.5 right-3 text-[12px] font-bold text-black/45">{counter}</span>
      </div>

      <div className="px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <p className="text-[18px] font-extrabold text-[var(--zx-ink)]">{getRecommendationName(recommendation)}</p>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: "var(--zx-brand-soft)", color: "var(--zx-brand-deep)" }}
          >
            {getBudgetLabel(recommendation)}
          </span>
        </div>
        {getAddress(recommendation) ? <p className="text-[13px] text-[var(--zx-muted)]">{getAddress(recommendation)}</p> : null}
        <div className="mt-1 flex items-center gap-2 text-[13px]">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              onPointerDown={(event) => event.stopPropagation()}
              className="font-semibold text-[var(--zx-brand)] underline-offset-2 hover:underline"
            >
              {distanceLabel ?? "Map"}
              {" ↗"}
            </a>
          ) : null}
          <span className="text-[var(--zx-faint)]">
            · {getRecommendationArea(recommendation)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Header({ proposedTime }: { proposedTime?: string }) {
  return (
    <div className="text-center">
      <p className="text-[22px] font-extrabold leading-tight text-[var(--zx-ink)]">Cast your vote</p>
      {proposedTime ? <p className="mt-1 text-[14px] font-semibold text-[var(--zx-muted)]">{proposedTime}</p> : null}
    </div>
  );
}

function Summary({
  names,
  count,
  selectedLimit,
  submitting,
  onUndo,
  onCast,
  hasSelectionCap
}: {
  names: string[];
  count: number;
  selectedLimit: number;
  submitting: boolean;
  onUndo: () => void;
  onCast: () => void;
  hasSelectionCap: boolean;
}) {
  return (
    <div className="mt-2">
      <div className="rounded-2xl border border-[var(--zx-line)] bg-[var(--zx-surface)] px-4 py-4 text-center">
        {count > 0 ? (
          <>
            <p className="mb-2 text-[13px] font-semibold text-[var(--zx-muted)]">
              Selected {count}
              {hasSelectionCap ? ` / ${selectedLimit}` : null} places
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {names.map((name) => (
                <span
                  key={name}
                  className="rounded-full px-2.5 py-1 text-[13px] font-bold"
                  style={{ background: "var(--zx-brand-soft)", color: "var(--zx-brand-deep)" }}
                >
                  👍 {name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[13px] font-semibold text-[var(--zx-muted)]">You skipped everything.</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onUndo}
          className="flex items-center gap-1.5 rounded-2xl border border-[var(--zx-line)] px-4 py-3.5 text-[14px] font-semibold text-[var(--zx-muted)]"
        >
          <RotateCcw size={16} aria-hidden />
          Undo
        </button>
        <button
          type="button"
          onClick={onCast}
          disabled={count === 0 || submitting}
          className="flex-1 rounded-2xl bg-[var(--zx-brand)] px-4 py-3.5 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit vote"}
        </button>
      </div>
    </div>
  );
}
