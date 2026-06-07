import { AlertTriangle, Clock3, MapPinned, PoundSterling, ShieldAlert, Trophy } from "lucide-react";

import type { BucketItem, PersonaId, PlanningCriteria } from "@/lib/domain";
import type { DemoRecommendation } from "@/lib/demo/data";
import { demoPersonas, formatMoney, getPersona } from "@/lib/demo/data";
import { Panel, PersonaDot, Pill } from "@/components/demo/primitives";

type CriteriaPanelProps = {
  criteria: PlanningCriteria[];
  currentPersonaId?: PersonaId;
};

type RecommendationPanelProps = {
  recommendations: DemoRecommendation[];
  currentPersonaId?: PersonaId;
};

function getDisplayPriceTier(item: BucketItem): "$" | "$$" | "$$$" {
  const normalizedPrice = item.priceEstimate.trim();
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

  if (tokenTier >= 3 || item.estimatedCost >= 40) {
    return "$$$";
  }

  if (tokenTier >= 2 || item.estimatedCost >= 25) {
    return "$$";
  }

  if (tokenTier >= 1 || item.estimatedCost > 0) {
    return "$";
  }

  return "$$";
}

export function CriteriaPanel({ criteria, currentPersonaId }: CriteriaPanelProps) {
  return (
    <Panel eyebrow="@planner inputs" title="Criteria collected">
      <div className="space-y-3">
        {criteria.map((entry) => {
          const persona = getPersona(entry.userId);
          const isActive = entry.userId === currentPersonaId;

          return (
            <article
              key={entry.userId}
              className="rounded-lg border px-3 py-3"
              style={{
                borderColor: isActive ? persona.color : "var(--line)",
                backgroundColor: isActive ? `${persona.color}12` : "#ffffff"
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PersonaDot persona={persona} />
                  <h3 className="text-sm font-semibold text-[var(--ink)]">{persona.name}</h3>
                </div>
                <Pill tone={isActive ? "accent" : "default"}>{entry.postalCode}</Pill>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-[var(--ink)] sm:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <PoundSterling size={14} aria-hidden="true" />
                  Max {formatMoney(entry.budgetMax)}
                </p>
                <p className="inline-flex items-center gap-2">
                  <ShieldAlert size={14} aria-hidden="true" />
                  {entry.vetoes.join(", ")}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {entry.availableTimes.map((slot) => (
                  <Pill key={slot} tone="muted" className="normal-case tracking-normal">
                    <Clock3 size={12} aria-hidden="true" className="mr-1" />
                    {slot}
                  </Pill>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export function RecommendationPanel({ recommendations, currentPersonaId }: RecommendationPanelProps) {
  return (
    <Panel
      eyebrow="Top 3"
      title="Planner picks"
      action={<Pill tone="warm">Shared pool {demoPersonas.length} friends</Pill>}
    >
      <div className="space-y-3">
        {recommendations.map((recommendation, index) => {
          const isOwnedByCurrentPersona = recommendation.item.userId === currentPersonaId;

          return (
            <article
              key={recommendation.bucketItemId}
              className="rounded-lg border border-[var(--line)] bg-white px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="accent">#{index + 1}</Pill>
                    <h3 className="text-base font-semibold text-[var(--ink)]">{recommendation.item.title}</h3>
                    {isOwnedByCurrentPersona ? <Pill tone="warm">From your saves</Pill> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span>{recommendation.item.neighborhood}</span>
                    <span aria-hidden="true">•</span>
                    <span>{recommendation.owner.name}</span>
                    <Pill tone="muted" className="normal-case tracking-normal">
                      {getDisplayPriceTier(recommendation.item)} tier
                    </Pill>
                  </div>
                  {recommendation.item.openingHours ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">{recommendation.item.openingHours}</p>
                  ) : null}
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-3 py-1.5 text-sm font-semibold text-white">
                  <Trophy size={14} aria-hidden="true" />
                  {recommendation.score}
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-[1fr_auto_1fr]">
                <div>
                  <p className="mb-2 inline-flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <MapPinned size={14} aria-hidden="true" />
                    Reasons
                  </p>
                  <ul className="space-y-1 text-[var(--muted)]">
                    {recommendation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <div className="hidden w-px bg-[var(--line)] md:block" aria-hidden="true" />

                <div>
                  <p className="mb-2 inline-flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <AlertTriangle size={14} aria-hidden="true" />
                    Warnings
                  </p>
                  <ul className="space-y-1 text-[var(--muted)]">
                    {recommendation.warnings.length > 0 ? (
                      recommendation.warnings.map((warning) => <li key={warning}>{warning}</li>)
                    ) : (
                      <li>No material warnings.</li>
                    )}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
