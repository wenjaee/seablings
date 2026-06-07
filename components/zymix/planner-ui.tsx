"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPinned,
  Trophy
} from "lucide-react";

import { PlannerCelebrationOverlay } from "@/components/planner/celebration-overlay";
import { PlannerConfirmedPlanCard } from "@/components/planner/confirmed-plan-card";
import { PlannerCriteriaSheet } from "@/components/planner/criteria-dialog";
import { PlannerVotingSheet } from "@/components/planner/voting-dialog";
import { PlannerWaitingBox } from "@/components/planner/waiting-box";
import { Avatar } from "@/components/zymix/avatar";
import { getZymixPersona, type AvatarSpec, type ZymixPersonaId } from "@/lib/zymix/data";
import type { PlannerRecommendationCard } from "@/lib/planner/types";

export type PlannerStatus = "collecting" | "voting" | "completed" | "canceled";

export type PlannerItem = {
  id: string;
  title: string;
  category?: string | null;
  neighborhood?: string | null;
  locationName?: string | null;
  photoUrl?: string | null;
  priceEstimate?: string | null;
  estimatedCost?: number | null;
  openingHours?: string | null;
  websiteUrl?: string | null;
};

export type PlannerOwner = {
  id?: string | null;
  name: string;
  avatar?: AvatarSpec | null;
};

export type PlannerRecommendation = {
  bucketItemId: string;
  score: number;
  reasons: string[];
  warnings: string[];
  distanceLabel?: string | null;
  mapsUrl?: string | null;
  item: PlannerItem;
  owner: PlannerOwner;
};

export type PlannerFinalPlan = {
  winnerIds: string[];
  winningItems: PlannerItem[];
  proposedTime?: string | null;
  calendarUrl?: string | null;
  voteCounts: Record<string, number>;
};

export type PlannerVote = {
  userId: string;
  bucketItemIds: string[];
  submittedAt?: string | null;
};

export type PlannerSession = {
  id: string;
  threadId: string;
  initiatorUserId?: string | null;
  status: PlannerStatus;
  participants: string[];
  criteriaByUserId: Record<string, unknown>;
  votesByUserId: Record<string, PlannerVote | undefined>;
  recommendations: PlannerRecommendation[];
  proposedTime?: string | null;
  finalPlan: PlannerFinalPlan | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  aggregateCriteria?: {
    availabilitySummary?: string | null;
    proposedTime?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    areaHints?: string[] | null;
    vibeHints?: string[] | null;
    vetoes?: string[] | null;
    strictVetoes?: string[] | null;
    source?: string | null;
    confidence?: number | null;
  } | null;
};

export type PlannerCriteriaAggregate = NonNullable<PlannerSession["aggregateCriteria"]>;

export type CriteriaSubmitPayload = {
  availability: string;
  availabilityMode: "Whenever" | "Custom";
  budgetMode: "slider";
  budgetAmount: number;
  budgetMax: number;
  budgetOption: string;
  budgetText?: string;
  vetoText?: string;
  vetoes: string[];
};

type RecommendationCardProps = {
  recommendation: PlannerRecommendation;
  selected?: boolean;
  onToggle?: () => void;
  compact?: boolean;
};

const CATEGORY_META: Record<
  string,
  {
    emoji: string;
    bg: string;
    fg: string;
    label: string;
  }
> = {
  bakery: { emoji: "🥐", bg: "#fdf0d5", fg: "#8a5a2b", label: "Bakery" },
  cafe: { emoji: "☕", bg: "#f6efe8", fg: "#75512d", label: "Cafe" },
  restaurant: { emoji: "🍽️", bg: "#fef0e8", fg: "#8d3f23", label: "Restaurant" },
  bar: { emoji: "🍸", bg: "#edf4ff", fg: "#27518e", label: "Bar" },
  nightlife: { emoji: "🌙", bg: "#eef0ff", fg: "#4a4ca8", label: "Nightlife" },
  activity: { emoji: "🎳", bg: "#edfdf4", fg: "#1d7a46", label: "Activity" },
  culture: { emoji: "🏛️", bg: "#f4f1ff", fg: "#5a4fcf", label: "Culture" },
  shopping: { emoji: "🛍️", bg: "#fff1f3", fg: "#a43a5f", label: "Shopping" },
  other: { emoji: "📍", bg: "#f4f4f5", fg: "#52525b", label: "Plan" }
};

const budgetRangeSentinel = 40;
const budgetRangeMin = 0;
const budgetRangeMinLabel = "£0";
const budgetRangeSentinelLabel = `>${"£"}40`;

function getParticipantLabel(participantId: string) {
  return getZymixPersona(participantId)?.name ?? participantId;
}

function getCategoryMeta(category?: string | null) {
  if (!category) {
    return CATEGORY_META.other;
  }

  return CATEGORY_META[category] ?? CATEGORY_META.other;
}

function getAreaLabel(item: PlannerItem) {
  return item.neighborhood ?? item.locationName ?? "Area TBD";
}

function getBudgetRangeLabel(value: number) {
  if (value === budgetRangeSentinel) {
    return budgetRangeSentinelLabel;
  }

  return `£${value}`;
}

function getBudgetPayloadOption(value: number) {
  if (value === budgetRangeSentinel) {
    return "Any budget";
  }

  return `Up to ${getBudgetRangeLabel(value)}`;
}

function getBudgetPayloadText(value: number) {
  if (value === budgetRangeSentinel) {
    return "41";
  }

  return String(value);
}

function getBudgetPayloadTextValue(value: number) {
  return value === budgetRangeSentinel ? 41 : value;
}

function toPlannerRecommendationCard(recommendation: PlannerRecommendation): PlannerRecommendationCard {
  const item = recommendation.item;
  const categoryMeta = getCategoryMeta(item.category);

  return {
    bucketItemId: recommendation.bucketItemId,
    name: item.title,
    title: item.title,
    area: getAreaLabel(item),
    address: item.locationName ?? item.neighborhood ?? undefined,
    emoji: categoryMeta.emoji,
    budgetTier: getDisplayPriceTier(item),
    distanceLabel: recommendation.distanceLabel ?? undefined,
    mapsUrl: recommendation.mapsUrl ?? undefined,
    photoUrl: item.photoUrl ?? undefined,
    item: {
      title: item.title,
      neighborhood: item.neighborhood ?? null,
      locationName: item.locationName ?? null,
      photoUrl: item.photoUrl ?? null
    }
  };
}

function toPlannerWinnerCard(item: PlannerItem): PlannerRecommendationCard {
  const categoryMeta = getCategoryMeta(item.category);

  return {
    bucketItemId: item.id,
    name: item.title,
    title: item.title,
    area: getAreaLabel(item),
    address: item.locationName ?? item.neighborhood ?? undefined,
    emoji: categoryMeta.emoji,
    budgetTier: getDisplayPriceTier(item),
    photoUrl: item.photoUrl ?? undefined,
    item: {
      title: item.title,
      neighborhood: item.neighborhood ?? null,
      locationName: item.locationName ?? null,
      photoUrl: item.photoUrl ?? null
    }
  };
}

function getBudgetDisplay(criteria?: PlannerCriteriaAggregate | null) {
  if (typeof criteria?.budgetMax === "number" && Number.isFinite(criteria.budgetMax) && criteria.budgetMax >= 0) {
    if (criteria.budgetMax > 40) {
      return budgetRangeSentinelLabel;
    }

    return `Up to £${Math.round(criteria.budgetMax)}`;
  }

  return null;
}

function getAggregateVetoesText(criteria: PlannerCriteriaAggregate | null | undefined) {
  const rawEntries = criteria?.strictVetoes?.length ? criteria.strictVetoes : criteria?.vetoes;
  if (!rawEntries || rawEntries.length === 0) {
    return null;
  }

  return rawEntries.join(", ");
}

function getAggregateAvailability(criteria: PlannerCriteriaAggregate | null | undefined) {
  if (criteria?.availabilitySummary) {
    return criteria.availabilitySummary;
  }

  if (criteria?.proposedTime) {
    return criteria.proposedTime;
  }

  return null;
}

function getDisplayPriceTier(item: PlannerItem) {
  const normalizedPrice = item.priceEstimate?.trim() ?? "";
  const tokens = normalizedPrice.match(/free|\$+|£+/gi) ?? [];
  const tokenTier = Math.max(
    ...tokens.map((token) => {
      if (/free/i.test(token)) {
        return 0;
      }

      return token.length;
    }),
    0
  );

  if (tokenTier >= 3 || (item.estimatedCost ?? 0) >= 40) {
    return "$$$";
  }

  if (tokenTier >= 2 || (item.estimatedCost ?? 0) >= 20) {
    return "$$";
  }

  if (tokenTier >= 1 || (item.estimatedCost ?? 0) > 0) {
    return "$";
  }

  return "$$";
}

function getWinningItems(session: PlannerSession) {
  const finalPlanItems = session.finalPlan?.winningItems ?? [];
  if (finalPlanItems.length > 0) {
    return finalPlanItems;
  }

  const winnerIds = session.finalPlan?.winnerIds ?? [];
  if (winnerIds.length === 0) {
    return [];
  }

  return winnerIds
    .map((winnerId) => session.recommendations.find((recommendation) => recommendation.bucketItemId === winnerId)?.item)
    .filter((item): item is PlannerItem => Boolean(item));
}

function getVoteCountEntries(session: PlannerSession) {
  const voteCounts = session.finalPlan?.voteCounts ?? {};
  return Object.entries(voteCounts)
    .map(([bucketItemId, count]) => {
      const match = session.recommendations.find((recommendation) => recommendation.bucketItemId === bucketItemId);
      return {
        bucketItemId,
        count,
        title: match?.item.title ?? bucketItemId
      };
    })
    .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title));
}

function RecommendationCard({ recommendation, selected = false, onToggle, compact = false }: RecommendationCardProps) {
  const meta = getCategoryMeta(recommendation.item.category);
  const ownerPersona = recommendation.owner.id ? getZymixPersona(recommendation.owner.id) : null;
  const [imageFailed, setImageFailed] = useState(false);
  const photoUrl = recommendation.item.photoUrl ?? undefined;
  const showPhoto = Boolean(photoUrl && !imageFailed);

  return (
    <article
      className={
        selected
          ? "rounded-[24px] border border-[var(--zx-brand)] bg-[#f0ffee] px-3.5 py-3 shadow-[0_10px_28px_rgba(53,201,60,0.14)]"
          : "rounded-[24px] border border-black/6 bg-white px-3.5 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
      }
    >
      <div className="flex items-start gap-3">
        <div
          className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl text-[20px]"
          style={{ backgroundColor: meta.bg, color: meta.fg }}
          aria-hidden
        >
          <span>{meta.emoji}</span>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-[16px] font-semibold leading-tight text-[var(--zx-ink)]">
                {recommendation.item.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--zx-muted)]">
                <span>{meta.label}</span>
                <span aria-hidden>•</span>
                <span>{getAreaLabel(recommendation.item)}</span>
                <span aria-hidden>•</span>
                <span>{getDisplayPriceTier(recommendation.item)}</span>
              </div>
            </div>

            <div className="shrink-0 rounded-full bg-[var(--zx-ink)] px-2.5 py-1 text-[12px] font-semibold text-white">
              {recommendation.score}
            </div>
          </div>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[12px] text-[var(--zx-muted)]">
            {ownerPersona ? <Avatar spec={ownerPersona.avatar} size={20} /> : null}
            <span className="min-w-0 flex-1 break-words">Saved by {recommendation.owner.name}</span>
            {recommendation.distanceLabel ? (
              <>
                <span aria-hidden>•</span>
                <span>{recommendation.distanceLabel}</span>
              </>
            ) : null}
          </div>

          {!compact && recommendation.item.openingHours ? (
            <p className="mt-2 break-words text-[12px] text-[var(--zx-muted)]">{recommendation.item.openingHours}</p>
          ) : null}
        </div>
      </div>

      <div className={compact ? "mt-3 space-y-2" : "mt-3 grid gap-3"}>
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--zx-faint)]">
            <MapPinned size={12} aria-hidden />
            Reasons
          </p>
          <ul className="space-y-1 text-[13px] leading-5 text-[var(--zx-ink)]">
            {recommendation.reasons.slice(0, compact ? 2 : 3).map((reason) => (
              <li key={reason} className="break-words">
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--zx-faint)]">
            <AlertTriangle size={12} aria-hidden />
            Warnings
          </p>
          <ul className="space-y-1 text-[13px] leading-5 text-[var(--zx-muted)]">
            {recommendation.warnings.length > 0 ? (
              recommendation.warnings.slice(0, compact ? 2 : 3).map((warning) => (
                <li key={warning} className="break-words">
                  {warning}
                </li>
              ))
            ) : (
              <li className="break-words">No material warnings.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {recommendation.mapsUrl ? (
          <a
            href={recommendation.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[var(--zx-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--zx-ink)]"
          >
            {recommendation.distanceLabel ? `Maps · ${recommendation.distanceLabel}` : "Open Maps"}
          </a>
        ) : null}
        {recommendation.item.websiteUrl ? (
          <a
            href={recommendation.item.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[var(--zx-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--zx-ink)]"
          >
            Website
          </a>
        ) : null}
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            className={
              selected
                ? "ml-auto rounded-full bg-[var(--zx-brand)] px-3.5 py-1.5 text-[12px] font-semibold text-white"
                : "ml-auto rounded-full border border-black/8 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[var(--zx-ink)]"
            }
          >
            {selected ? "Selected" : "Select"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function StepChip({ isActive, isDone, label }: { isActive: boolean; isDone: boolean; label: string }) {
  return (
    <div
      className={
        isActive
          ? "grid h-8 w-8 place-items-center rounded-full bg-[var(--zx-brand)] text-[12px] font-semibold text-white"
          : isDone
            ? "grid h-8 w-8 place-items-center rounded-full bg-[#dff7de] text-[12px] font-semibold text-[#1d7a46]"
            : "grid h-8 w-8 place-items-center rounded-full bg-[var(--zx-surface)] text-[12px] font-semibold text-[var(--zx-muted)]"
      }
      aria-label={label}
    >
      {isDone ? <Check size={14} aria-hidden /> : label}
    </div>
  );
}

function ChoiceButton({
  label,
  selected,
  onClick
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? "rounded-[18px] border border-[var(--zx-brand)] bg-[#f0ffee] px-3.5 py-3 text-left text-[14px] font-medium text-[var(--zx-ink)]"
          : "rounded-[18px] border border-black/8 bg-white px-3.5 py-3 text-left text-[14px] font-medium text-[var(--zx-ink)]"
      }
    >
      {label}
    </button>
  );
}

export function PlannerCriteriaOverlay({
  sessionId,
  isSubmitting,
  error,
  onSubmit
}: {
  sessionId: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (payload: CriteriaSubmitPayload) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [usesWhenever, setUsesWhenever] = useState(true);
  const [availabilityCustom, setAvailabilityCustom] = useState("");
  const [budget, setBudget] = useState(budgetRangeSentinel);
  const [vetoText, setVetoText] = useState("");

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setStep(0);
      setUsesWhenever(true);
      setAvailabilityCustom("");
      setBudget(budgetRangeSentinel);
      setVetoText("");
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [sessionId]);

  const canContinue =
    step === 0
      ? usesWhenever || Boolean(availabilityCustom.trim())
      : step === 1
        ? true
        : true;

  async function submit() {
    const customAvailability = availabilityCustom.trim();
    const normalizedAvailability = usesWhenever ? "Whenever" : customAvailability;
    const vetoes = vetoText.trim() ? [vetoText.trim()] : [];
    const normalizedAvailabilityMode = usesWhenever ? "Whenever" : "Custom";

    if (!normalizedAvailability) {
      throw new Error("Please tell us your availability.");
    }

    await onSubmit({
      availability: normalizedAvailability,
      availabilityMode: normalizedAvailabilityMode,
      budgetMode: "slider",
      budgetAmount: getBudgetPayloadTextValue(budget),
      budgetMax: getBudgetPayloadTextValue(budget),
      budgetOption: getBudgetPayloadOption(budget),
      budgetText: getBudgetPayloadText(budget),
      vetoes,
      vetoText: vetoText.trim()
    });
  }

  return (
    <section className="mx-3 mb-2 rounded-[28px] border border-black/6 bg-white px-4 py-4 shadow-[0_18px_36px_rgba(15,23,42,0.10)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--zx-faint)]">@planner private</p>
          <h2 className="mt-1 min-w-0 break-words text-[17px] font-semibold text-[var(--zx-ink)]">Share your criteria</h2>
        </div>
        <span className="rounded-full bg-[var(--zx-surface)] px-3 py-1 text-[12px] font-semibold text-[var(--zx-muted)]">
          {step + 1}/3
        </span>
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-2">
        <StepChip isActive={step === 0} isDone={step > 0} label="1" />
        <div className="h-px flex-1 bg-black/8" aria-hidden />
        <StepChip isActive={step === 1} isDone={step > 1} label="2" />
        <div className="h-px flex-1 bg-black/8" aria-hidden />
        <StepChip isActive={step === 2} isDone={false} label="3" />
      </div>

      {step === 0 ? (
        <div className="mt-4">
          <p className="text-[14px] font-medium text-[var(--zx-ink)]">When can you do?</p>
          <div className="mt-3 grid gap-2">
            <ChoiceButton
              label="Whenever"
              selected={usesWhenever}
              onClick={() => {
                setUsesWhenever(true);
                setAvailabilityCustom("");
              }}
            />
            <input
              value={availabilityCustom}
              onFocus={() => setUsesWhenever(false)}
              onChange={(event) => {
                const nextValue = event.target.value;
                setAvailabilityCustom(nextValue);
                setUsesWhenever(nextValue.trim().length === 0);
              }}
              aria-label="Custom availability"
              className={
                usesWhenever
                  ? "min-w-0 w-full rounded-[18px] border border-black/8 bg-[var(--zx-surface)] px-4 py-3 text-[14px] text-[var(--zx-ink)] outline-none break-words"
                  : "min-w-0 w-full rounded-[18px] border border-[var(--zx-brand)] bg-[#f0ffee] px-4 py-3 text-[14px] text-[var(--zx-ink)] outline-none break-words"
              }
            />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-4">
          <p className="text-[14px] font-medium text-[var(--zx-ink)]">What budget works?</p>
          <p className="mt-2 text-[13px] text-[var(--zx-muted)]">
            Current budget: <span className="font-medium text-[var(--zx-ink)]">{getBudgetRangeLabel(budget)}</span>
          </p>
          <input
            value={budget}
            onChange={(event) => setBudget(Number(event.target.value))}
            min={budgetRangeMin}
            max={budgetRangeSentinel}
            step={10}
            type="range"
            aria-label="Budget slider"
            aria-valuetext={getBudgetRangeLabel(budget)}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-[var(--zx-brand)]"
          />
          <div className="mt-2 flex justify-between text-[11px] font-medium text-[var(--zx-muted)]">
            <span>{budgetRangeMinLabel}</span>
            <span>£10</span>
            <span>£20</span>
            <span>£30</span>
            <span>{budgetRangeSentinelLabel}</span>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4">
          <p className="text-[14px] font-medium text-[var(--zx-ink)]">Anything that rules a place out?</p>
          <textarea
            value={vetoText}
            onChange={(event) => setVetoText(event.target.value)}
            placeholder="E.g. No alcohol, I don't want anywhere sunny"
            aria-label="Vetoes"
            rows={3}
            className="mt-3 min-w-0 w-full resize-y rounded-[18px] border border-black/8 bg-[var(--zx-surface)] px-4 py-3 text-[14px] leading-6 text-[var(--zx-ink)] outline-none break-words placeholder:text-[var(--zx-muted)]"
          />
        </div>
      ) : null}

      {error ? <p className="mt-3 break-words text-[13px] text-[#d94c3d]">{error}</p> : null}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStep((previousStep) => Math.max(0, previousStep - 1))}
          disabled={step === 0 || isSubmitting}
          className="grid h-11 w-11 place-items-center rounded-full border border-black/8 bg-white text-[var(--zx-ink)] disabled:opacity-50"
          aria-label="Previous step"
        >
          <ChevronLeft size={18} />
        </button>

        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep((previousStep) => Math.min(2, previousStep + 1))}
            disabled={!canContinue || isSubmitting}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--zx-ink)] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            Next
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={!canContinue || isSubmitting}
            className="flex h-11 flex-1 items-center justify-center rounded-full bg-[var(--zx-brand)] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        )}
      </div>
    </section>
  );
}

export function PlannerVotingOverlay({
  session,
  isSubmitting,
  error,
  onSubmit
}: {
  session: PlannerSession;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (bucketItemIds: string[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setSelectedIds([]);
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [session.id, session.updatedAt]);

  const selectionSummary = useMemo(() => `${selectedIds.length}/3 picked`, [selectedIds.length]);

  return (
    <section className="mx-3 mb-2 rounded-[28px] border border-black/6 bg-white px-4 py-4 shadow-[0_18px_36px_rgba(15,23,42,0.10)]">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--zx-faint)]">@planner private</p>
          <h2 className="mt-1 min-w-0 break-words text-[17px] font-semibold text-[var(--zx-ink)]">Cast your vote</h2>
        </div>
        <span className="rounded-full bg-[var(--zx-surface)] px-3 py-1 text-[12px] font-semibold text-[var(--zx-muted)]">{selectionSummary}</span>
      </div>

      {session.proposedTime ? (
        <p className="mt-3 inline-flex min-w-0 flex-wrap items-center gap-2 break-words text-[13px] text-[var(--zx-muted)]">
          <Clock3 size={14} aria-hidden />
          Proposed time: {session.proposedTime}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {session.recommendations.map((recommendation) => {
          const isSelected = selectedIds.includes(recommendation.bucketItemId);
          return (
            <RecommendationCard
              key={recommendation.bucketItemId}
              recommendation={recommendation}
              selected={isSelected}
              onToggle={() =>
                setSelectedIds((previousIds) => {
                  if (isSelected) {
                    return previousIds.filter((id) => id !== recommendation.bucketItemId);
                  }

                  if (previousIds.length >= 3) {
                    return previousIds;
                  }

                  return [...previousIds, recommendation.bucketItemId];
                })
              }
            />
          );
        })}
      </div>

      {error ? <p className="mt-3 break-words text-[13px] text-[#d94c3d]">{error}</p> : null}

      <button
        type="button"
        onClick={() => {
          void onSubmit(selectedIds);
        }}
        disabled={selectedIds.length === 0 || isSubmitting}
        className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[var(--zx-brand)] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? "Casting..." : "Cast Vote"}
      </button>
    </section>
  );
}

export function PlannerSpectatorNotice({ session }: { session: PlannerSession }) {
  const participantNames = session.participants.map(getParticipantLabel);

  return (
    <section className="mx-3 mb-2 rounded-[24px] border border-dashed border-black/10 bg-white/85 px-4 py-3">
      <p className="break-words text-[13px] text-[var(--zx-muted)]">
        {participantNames.join(", ")} are voting in the planner flow.
      </p>
    </section>
  );
}

export function PlannerStateCard({
  session,
  currentPersonaId,
  canCancel = false,
  isCanceling = false,
  cancelError,
  onCancel
}: {
  session: PlannerSession;
  currentPersonaId: ZymixPersonaId;
  canCancel?: boolean;
  isCanceling?: boolean;
  cancelError?: string | null;
  onCancel?: () => Promise<void> | void;
}) {
  const isCollecting = session.status === "collecting";
  const isVoting = session.status === "voting";
  const isActiveSession = isCollecting || isVoting;
  const criteriaCount = Object.keys(session.criteriaByUserId).length;
  const participantCount = session.participants.length;
  const missingCriteria = session.participants.filter((participantId) => !session.criteriaByUserId[participantId]);
  const missingVotes = session.participants.filter((participantId) => !session.votesByUserId[participantId]);
  const aggregateCriteria = session.aggregateCriteria;
  const aggregateAvailability = getAggregateAvailability(aggregateCriteria);
  const aggregateBudget = getBudgetDisplay(aggregateCriteria);
  const aggregateVetoes = getAggregateVetoesText(aggregateCriteria);
  const shouldShowAggregateCriteria = Boolean(aggregateAvailability || aggregateBudget || aggregateVetoes);

  if (session.status === "completed") {
    return null;
  }

  if (isVoting) {
    const waitingOn = missingVotes.map(getParticipantLabel).join(", ");

    return (
      <section className="mb-4 rounded-[28px] border border-black/6 bg-white px-4 py-4 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
        <h2 className="break-words text-[18px] font-semibold text-[var(--zx-ink)]">Shortlist ready</h2>

        <div className="mt-4 space-y-3">
          {shouldShowAggregateCriteria ? (
            <div className="rounded-[22px] bg-[var(--zx-surface)] px-4 py-3">
              <p className="text-[12px] font-semibold text-[var(--zx-muted)]">Outing Details</p>
              {aggregateAvailability ? <p className="mt-1.5 break-words text-[14px] font-medium text-[var(--zx-ink)]">Availability: {aggregateAvailability}</p> : null}
              {aggregateBudget ? (
                <p className="mt-1.5 break-words text-[14px] text-[var(--zx-ink)]">Budget: {aggregateBudget}</p>
              ) : null}
              {aggregateVetoes ? <p className="mt-1.5 break-words text-[14px] text-[var(--zx-ink)]">Vetoes: {aggregateVetoes}</p> : null}
            </div>
          ) : null}

          <div className="rounded-[22px] bg-[var(--zx-surface)] px-4 py-3">
            <p className="break-words text-[14px] font-semibold text-[var(--zx-ink)]">
              {missingVotes.length > 0 ? `Waiting on ${waitingOn}` : "All votes submitted"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-[28px] border border-black/6 bg-white px-4 py-4 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--zx-faint)]">@planner live</p>
          <h2 className="mt-1 break-words text-[18px] font-semibold text-[var(--zx-ink)]">
            {session.status === "collecting"
              ? "Collecting criteria"
              : session.status === "voting"
                ? "Shortlist ready"
                : "Planner canceled"}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={
              session.status === "canceled"
                ? "rounded-full bg-[#ffe6e2] px-3 py-1 text-[12px] font-semibold text-[#b42318]"
                : "rounded-full bg-[var(--zx-surface)] px-3 py-1 text-[12px] font-semibold text-[var(--zx-muted)]"
            }
          >
            {session.status}
          </span>
          {canCancel && isActiveSession ? (
            <button
              type="button"
              onClick={() => {
                void onCancel?.();
              }}
              disabled={isCanceling}
              aria-label="Cancel plan"
              className="inline-flex h-8 items-center justify-center rounded-full border border-[#f87171] bg-white px-3 py-1 text-[12px] font-semibold text-[#b42318] transition-colors disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isCanceling ? "Canceling…" : "Cancel plan"}
            </button>
          ) : null}
        </div>
      </div>

      {cancelError ? <p className="mt-3 break-words text-[13px] text-[#d94c3d]">{cancelError}</p> : null}

      {isCollecting ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-[22px] bg-[var(--zx-surface)] px-4 py-3">
            <p className="text-[13px] text-[var(--zx-muted)]">Criteria submitted</p>
            <p className="mt-1 text-[24px] font-semibold text-[var(--zx-ink)]">
              {criteriaCount}/{participantCount}
            </p>
            {missingCriteria.length > 0 ? (
              <p className="mt-2 break-words text-[13px] text-[var(--zx-muted)]">
                Waiting on {missingCriteria.map(getParticipantLabel).join(", ")}.
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--zx-muted)]">Everyone is in. Finalizing the shortlist.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {session.participants.map((participantId) => {
              const isComplete = Boolean(session.criteriaByUserId[participantId]);
              const isCurrent = participantId === currentPersonaId;

              return (
                <span
                  key={participantId}
                  className={
                    isComplete
                      ? "max-w-full break-words rounded-full bg-[#dff7de] px-3 py-1.5 text-[12px] font-medium text-[#1d7a46]"
                      : isCurrent
                        ? "max-w-full break-words rounded-full bg-[#fff2cf] px-3 py-1.5 text-[12px] font-medium text-[#946600]"
                        : "max-w-full break-words rounded-full bg-[var(--zx-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--zx-muted)]"
                  }
                >
                  {getParticipantLabel(participantId)}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {session.status === "canceled" ? (
        <div className="mt-4 space-y-2 rounded-[22px] bg-[#fff1f0] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#9f2417]">Planner was canceled</p>
          <p className="text-[12px] leading-5 text-[var(--zx-muted)]">This planning run ended.</p>
        </div>
      ) : null}

    </section>
  );
}

export function PlannerDock({
  session,
  showCriteriaOverlay,
  showVotingOverlay,
  isSubmittingCriteria,
  isSubmittingVote,
  criteriaError,
  voteError,
  onSubmitCriteria,
  onSubmitVote
}: {
  session: PlannerSession;
  showCriteriaOverlay: boolean;
  showVotingOverlay: boolean;
  isSubmittingCriteria: boolean;
  isSubmittingVote: boolean;
  criteriaError: string | null;
  voteError: string | null;
  onSubmitCriteria: (payload: CriteriaSubmitPayload) => Promise<void>;
  onSubmitVote: (bucketItemIds: string[]) => Promise<void>;
}) {
  if (!showCriteriaOverlay && !showVotingOverlay) {
    return null;
  }

  const recommendationCards = session.recommendations.map(toPlannerRecommendationCard);

  return (
    <div className="px-2 pb-2 pt-2">
      <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-black/20" />

      {showCriteriaOverlay ? (
        <PlannerCriteriaSheet
          isSubmitting={isSubmittingCriteria}
          error={criteriaError}
          onSubmit={onSubmitCriteria}
        />
      ) : null}

      {showVotingOverlay ? (
        <PlannerVotingSheet
          proposedTime={session.proposedTime ?? undefined}
          recommendations={recommendationCards}
          isSubmitting={isSubmittingVote}
          error={voteError}
          onSubmit={onSubmitVote}
        />
      ) : null}
    </div>
  );
}

export function PlannerThread({
  session,
  currentPersonaId,
  isCanceling,
  canCancel,
  cancelError,
  isMinimized = false,
  onCancel,
  onConfirmPlan,
  onRemovePlan,
  isRemovingPlan = false
}: {
  session: PlannerSession;
  currentPersonaId: ZymixPersonaId;
  isCanceling: boolean;
  canCancel: boolean;
  cancelError?: string | null;
  isMinimized?: boolean;
  onCancel?: () => Promise<void> | void;
  onConfirmPlan?: () => void;
  onRemovePlan?: () => Promise<void> | void;
  isRemovingPlan?: boolean;
}) {
  if (session.status === "canceled") {
    return null;
  }

  const isCollecting = session.status === "collecting";
  const isCompleted = session.status === "completed";
  const hasSubmittedCriteria = Boolean(session.criteriaByUserId[currentPersonaId]);
  const missingCriteria = session.participants.filter((participantId) => !session.criteriaByUserId[participantId]);
  const criteriaMembers = session.participants.map((participantId) => ({
    userId: participantId,
    name: getParticipantLabel(participantId),
    respondedCriteria: Boolean(session.criteriaByUserId[participantId])
  }));

  const showCriteriaWaiting = isCollecting && hasSubmittedCriteria && missingCriteria.length > 0;

  return (
    <section className="mb-2 space-y-2">
      <PlannerStateCard
        session={session}
        currentPersonaId={currentPersonaId}
        canCancel={canCancel}
        isCanceling={isCanceling}
        cancelError={cancelError ?? null}
        onCancel={onCancel}
      />

      {showCriteriaWaiting ? (
        <PlannerWaitingBox title="Waiting for criteria" members={criteriaMembers} doneLabel="submitted" />
      ) : null}

      {isCompleted && !isMinimized ? (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--zx-faint)]">Confirmed plan</p>
          <PlannerConfirmationCompact
            session={session}
            onConfirmPlan={onConfirmPlan}
            onRemovePlan={onRemovePlan}
            isRemovingPlan={isRemovingPlan}
          />
        </div>
      ) : null}
    </section>
  );
}

function PlannerConfirmationCompact({
  session,
  onConfirmPlan,
  onRemovePlan,
  isRemovingPlan = false
}: {
  session: PlannerSession;
  onConfirmPlan?: () => void;
  onRemovePlan?: () => Promise<void> | void;
  isRemovingPlan?: boolean;
}) {
  const winningItems = getWinningItems(session);
  const voteEntries = getVoteCountEntries(session);
  const calendarUrl = `/api/planner-session/calendar?threadId=${encodeURIComponent(session.threadId)}`;
  const winnerCards = winningItems.map(toPlannerWinnerCard);
  const combinedWinnerCard: PlannerRecommendationCard = {
    bucketItemId: "final-plan",
    name: winnerCards.map((winner) => winner.name).join(" + ") || "Final plan",
    title: winnerCards.map((winner) => winner.title).join(" + ") || "Final plan",
    area: Array.from(new Set(winnerCards.map((winner) => winner.area).filter(Boolean))).join(" + ") || "Area TBD",
    budgetTier: Array.from(new Set(winnerCards.map((winner) => winner.budgetTier).filter(Boolean))).join(" / ") || "$$",
    photoUrl: winnerCards.find((winner) => winner.photoUrl)?.photoUrl
  };

  if (winningItems.length === 0 && voteEntries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      {winningItems.length > 0 ? (
        <PlannerConfirmedPlanCard
          winner={combinedWinnerCard}
          proposedTime={session.finalPlan?.proposedTime ?? session.proposedTime ?? undefined}
          calendarUrl={calendarUrl}
          onConfirm={onConfirmPlan}
          onRemove={onRemovePlan}
          isRemoving={isRemovingPlan}
        />
      ) : null}

      {voteEntries.length > 0 ? (
        <div className="rounded-[20px] bg-[var(--zx-surface)] px-4 py-3">
          <p className="mb-2 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--zx-faint)]">
            <Trophy size={12} aria-hidden />
            Vote counts
          </p>
          <div className="flex flex-wrap gap-2">
            {voteEntries.map((entry) => (
              <span
                key={entry.bucketItemId}
                className="max-w-full break-words rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--zx-ink)]"
              >
                {entry.title}: {entry.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PlannerCelebration({
  session,
  show
}: {
  session: PlannerSession;
  show: boolean;
}) {
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);
  const shouldShow = show && session.status === "completed" && dismissedSessionId !== session.id;

  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDismissedSessionId(session.id);
    }, 2600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [session.id, shouldShow]);

  if (!shouldShow) {
    return null;
  }

  const winners = getWinningItems(session).map(toPlannerWinnerCard);
  const fallbackWinners: PlannerRecommendationCard[] = [
    {
      bucketItemId: "final-plan",
      name: "your final picks",
      title: "your final picks"
    }
  ];

  return (
    <div className="fixed inset-0 z-40">
      <PlannerCelebrationOverlay
        winners={winners.length > 0 ? winners : fallbackWinners}
        proposedTime={session.finalPlan?.proposedTime ?? session.proposedTime ?? undefined}
        onDismiss={() => setDismissedSessionId(session.id)}
      />
    </div>
  );
}
