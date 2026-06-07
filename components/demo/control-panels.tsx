import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, Link2, LoaderCircle, MapPin, ScanSearch } from "lucide-react";

import type { BucketItem, PersonaId } from "@/lib/domain";
import type { DemoCaptureTask } from "@/lib/demo/data";
import { demoPersonas, formatTime, getPersona, getSourceLabel, getStatusLabel } from "@/lib/demo/data";
import { Panel, PersonaDot, Pill } from "@/components/demo/primitives";

type CaptureQueuePanelProps = {
  tasks: DemoCaptureTask[];
};

type PooledSpotsPanelProps = {
  items: BucketItem[];
};

type PersonaLinksPanelProps = {
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

function formatEnrichmentStatus(status: string): string {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function CaptureQueuePanel({ tasks }: CaptureQueuePanelProps) {
  return (
    <Panel eyebrow="Capture loop" title="Queue and status">
      <div className="divide-y divide-[var(--line)]">
        {tasks.map((task) => {
          const persona = getPersona(task.userId);
          const isQueued = task.status === "queued";

          return (
            <article key={task.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <PersonaDot persona={persona} />
                  <p className="text-sm font-semibold text-[var(--ink)]">{task.label}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 size={12} aria-hidden="true" />
                    {getSourceLabel(task.sourceType)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={12} aria-hidden="true" />
                    {formatTime(task.updatedAt)}
                  </span>
                </div>
              </div>

              <Pill tone={isQueued ? "warm" : "accent"}>
                {isQueued ? <LoaderCircle size={12} aria-hidden="true" className="mr-1" /> : <CheckCircle2 size={12} aria-hidden="true" className="mr-1" />}
                {task.status}
              </Pill>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export function PooledSpotsPanel({ items }: PooledSpotsPanelProps) {
  return (
    <Panel eyebrow="Shared pool" title="All candidate and saved spots">
      <div className="divide-y divide-[var(--line)]">
        {items.map((item) => {
          const owner = getPersona(item.userId);
          const enrichmentLinks = item.enrichmentSourceLinks?.filter(Boolean) ?? [];
          const hasEnrichmentMeta =
            Boolean(item.enrichmentStatus) || enrichmentLinks.length > 0 || Boolean(item.enrichmentConfidenceNote);

          return (
            <article key={item.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--ink)]">{item.title}</h3>
                    <Pill tone={item.status === "candidate" ? "warm" : "default"}>{getStatusLabel(item.status)}</Pill>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <PersonaDot persona={owner} />
                      {owner.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={12} aria-hidden="true" />
                      {item.neighborhood}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Link2 size={12} aria-hidden="true" />
                      {getSourceLabel(item.sourceType)}
                    </span>
                    {item.openingHours ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={12} aria-hidden="true" />
                        {item.openingHours}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="text-sm font-semibold text-[var(--ink)]">{getDisplayPriceTier(item)}</span>
              </div>

              {hasEnrichmentMeta ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  {item.enrichmentStatus ? (
                    <Pill tone="muted" className="normal-case tracking-normal">
                      {formatEnrichmentStatus(item.enrichmentStatus)}
                    </Pill>
                  ) : null}
                  {item.enrichmentConfidenceNote ? <span>{item.enrichmentConfidenceNote}</span> : null}
                  {enrichmentLinks.slice(0, 2).map((link, index) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-[var(--ink)]"
                    >
                      Source {index + 1}
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </a>
                  ))}
                  {enrichmentLinks.length > 2 ? <span>+{enrichmentLinks.length - 2} more</span> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export function PersonaLinksPanel({ currentPersonaId }: PersonaLinksPanelProps) {
  return (
    <Panel eyebrow="Judge path" title="Open persona views">
      <div className="grid gap-3 sm:grid-cols-3">
        {demoPersonas.map((persona) => {
          const isActive = currentPersonaId === persona.id;

          return (
            <Link
              key={persona.id}
              href={`/demo/${persona.id}`}
              className="rounded-lg border border-[var(--line)] bg-white px-4 py-4 transition-colors hover:border-[var(--ink)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PersonaDot persona={persona} />
                  <span className="text-sm font-semibold text-[var(--ink)]">{persona.name}</span>
                </div>
                <ArrowUpRight size={16} aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                {isActive ? "Currently open in this viewport." : "Open this mobile persona route."}
              </p>
            </Link>
          );
        })}

        <div className="rounded-lg border border-dashed border-[var(--line)] bg-[#eef2f0] px-4 py-4">
          <div className="flex items-center gap-2">
            <ScanSearch size={16} aria-hidden="true" />
            <span className="text-sm font-semibold text-[var(--ink)]">Control mode</span>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Stay here for the full loop view: captures, pool, criteria, and ranked output.
          </p>
        </div>
      </div>
    </Panel>
  );
}
