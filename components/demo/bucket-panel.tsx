import { Bookmark, MapPin, Radio, Sparkles } from "lucide-react";

import type { BucketItem, Persona } from "@/lib/domain";
import { formatMoney, getSourceLabel, getStatusLabel } from "@/lib/demo/data";
import { Panel, Pill } from "@/components/demo/primitives";

type BucketPanelProps = {
  persona: Persona;
  items: BucketItem[];
};

export function BucketPanel({ persona, items }: BucketPanelProps) {
  return (
    <Panel
      eyebrow="Personal spots"
      title={`${persona.name}'s bucket`}
      action={<Pill tone="accent">{items.length} spots</Pill>}
    >
      <div className="divide-y divide-[var(--line)]">
        {items.map((item) => {
          const isLiveShare = item.status === "candidate" && item.sourceType !== "manual";

          return (
            <article key={item.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                    <Pill tone={item.status === "candidate" ? "warm" : "default"}>{getStatusLabel(item.status)}</Pill>
                    {isLiveShare ? (
                      <Pill tone="accent">
                        <Radio size={12} aria-hidden="true" className="mr-1" />
                        Live share
                      </Pill>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-[var(--ink)]">{item.priceEstimate}</p>
                  <p className="text-xs text-[var(--muted)]">{formatMoney(item.estimatedCost)}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} aria-hidden="true" />
                  {item.neighborhood}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bookmark size={13} aria-hidden="true" />
                  {item.category.replace("_", " ")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles size={13} aria-hidden="true" />
                  {getSourceLabel(item.sourceType)}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{item.whyInteresting}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Pill key={tag} tone="muted">
                    {tag}
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
