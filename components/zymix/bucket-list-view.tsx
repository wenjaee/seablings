"use client";

import { ArrowUpRight, CalendarDays, Check } from "lucide-react";
import { useCallback, useState } from "react";

import { derivePriceTier } from "@/lib/bucket-ui";
import type { BucketItem } from "@/lib/domain";

type PriceTier = "$" | "$$" | "$$$";
type VisitedFilter = "all" | "not_visited" | "visited";

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  screenshot: "Screenshot",
  manual: "Manual",
  text: "Text",
};

export function BucketListView({ items: initial }: { items: BucketItem[] }) {
  const [items, setItems] = useState(initial);
  const [selectedItem, setSelectedItem] = useState<BucketItem | null>(null);
  const [priceTiers, setPriceTiers] = useState<Set<PriceTier>>(new Set());
  const [visitedFilter, setVisitedFilter] = useState<VisitedFilter>("all");
  const [openNow, setOpenNow] = useState(false);

  const togglePriceTier = (tier: PriceTier) => {
    setPriceTiers((prev) => {
      const next = new Set(prev);
      next.has(tier) ? next.delete(tier) : next.add(tier);
      return next;
    });
  };

  const toggleVisited = useCallback(
    async (item: BucketItem) => {
      const next = item.status === "completed" ? "saved" : "completed";
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
      setSelectedItem((prev) => (prev?.id === item.id ? { ...prev, status: next } : prev));
      try {
        await fetch(`/api/bucket-items/${item.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
      } catch {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
        setSelectedItem((prev) => (prev?.id === item.id ? { ...prev, status: item.status } : prev));
      }
    },
    [],
  );

  const filtered = items.filter((item) => {
    const tier = derivePriceTier(item.estimatedCost);
    if (priceTiers.size > 0 && !priceTiers.has(tier)) return false;
    if (visitedFilter === "visited" && item.status !== "completed") return false;
    if (visitedFilter === "not_visited" && item.status === "completed") return false;
    if (openNow && !item.openingHours) return false;
    return true;
  });

  return (
    <>
      {/* Filter bar */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {(["$", "$$", "$$$"] as PriceTier[]).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => togglePriceTier(tier)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
              priceTiers.has(tier)
                ? "border-[var(--zx-brand)] bg-[var(--zx-brand)] text-[var(--zx-brand-deep)]"
                : "border-[var(--zx-line)] text-[var(--zx-muted)]"
            }`}
          >
            {tier}
          </button>
        ))}
        {(
          [
            ["all", "All"],
            ["not_visited", "Not visited"],
            ["visited", "Visited"],
          ] as [VisitedFilter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setVisitedFilter(f)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
              visitedFilter === f
                ? "border-[var(--zx-brand)] bg-[var(--zx-brand)] text-[var(--zx-brand-deep)]"
                : "border-[var(--zx-line)] text-[var(--zx-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpenNow((v) => !v)}
          className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
            openNow
              ? "border-[var(--zx-brand)] bg-[var(--zx-brand)] text-[var(--zx-brand-deep)]"
              : "border-[var(--zx-line)] text-[var(--zx-muted)]"
          }`}
        >
          Open now
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-[var(--zx-muted)]">
          No places match these filters.
        </p>
      ) : (
        <div>
          {filtered.map((item) => {
            const visited = item.status === "completed";
            const tier = derivePriceTier(item.estimatedCost);
            const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(item.address ?? item.neighborhood ?? item.locationName)}`;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-[var(--zx-line)] py-3"
              >
                <button
                  type="button"
                  onClick={() => toggleVisited(item)}
                  aria-label={visited ? "Mark as not visited" : "Mark as visited"}
                  className="shrink-0"
                >
                  <Checkmark visited={visited} />
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="w-full text-left"
                  >
                    <p className="text-[14px] font-semibold text-[var(--zx-ink)]">{item.title}</p>
                  </button>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-medium"
                    style={{ color: "var(--zx-brand)" }}
                  >
                    {item.neighborhood}
                  </a>
                </div>

                <span className="shrink-0 text-[12px] text-[var(--zx-faint)]">{tier}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom sheet */}
      {selectedItem && (
        <ItemSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onToggleVisited={() => toggleVisited(selectedItem)}
        />
      )}
    </>
  );
}

function Checkmark({ visited }: { visited: boolean }) {
  return (
    <div
      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
        visited ? "border-[var(--zx-brand)] bg-[var(--zx-brand)]" : "border-[var(--zx-faint)]"
      }`}
    >
      {visited && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="var(--zx-brand-deep)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

function ItemSheet({
  item,
  onClose,
  onToggleVisited,
}: {
  item: BucketItem;
  onClose: () => void;
  onToggleVisited: () => void;
}) {
  const visited = item.status === "completed";
  const tier = derivePriceTier(item.estimatedCost);
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(item.address ?? item.neighborhood ?? item.locationName)}`;
  const displayAddress = item.address ?? item.neighborhood;

  const hoursRows: Array<{ day: string; hours: string | null }> =
    item.openingHoursRows ??
    (item.openingHours ? [{ day: "", hours: item.openingHours }] : []);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />

      {/* Sheet panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] rounded-t-3xl bg-white px-5 pb-10 pt-7 shadow-2xl">
        {/* Drag handle */}
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[var(--zx-line)]" />

        {/* Title */}
        <h2 className="mb-3 text-[24px] font-extrabold leading-tight text-[var(--zx-ink)]">
          {item.title}
        </h2>

        {/* Chips row */}
        <div className="mb-1 flex items-center gap-2">
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[var(--zx-ink)] px-3 py-1 text-[12px] font-semibold text-white"
            >
              <CalendarDays size={11} />
              {PLATFORM_LABEL[item.sourceType] ?? item.sourceType}
            </a>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--zx-ink)] px-3 py-1 text-[12px] font-semibold text-white">
              <CalendarDays size={11} />
              {PLATFORM_LABEL[item.sourceType] ?? item.sourceType}
            </span>
          )}
          {item.openingHours && (
            <span
              className="rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ background: "var(--zx-brand-soft)", color: "var(--zx-brand-deep)" }}
            >
              Open now
            </span>
          )}
          <span className="ml-auto text-[13px] text-[var(--zx-faint)]">{tier}</span>
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-[var(--zx-line)]" />

        {/* Location */}
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--zx-muted)]">
          Location
        </p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-1 flex items-center gap-1 text-[15px] font-semibold"
          style={{ color: "var(--zx-brand)" }}
        >
          {displayAddress}
          <ArrowUpRight size={14} style={{ color: "var(--zx-brand)" }} />
        </a>

        {/* Divider */}
        <div className="my-4 h-px bg-[var(--zx-line)]" />

        {/* Opening hours */}
        {hoursRows.length > 0 && (
          <>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--zx-muted)]">
              Opening hours
            </p>
            <div className="mb-1 space-y-1.5">
              {hoursRows.map(({ day, hours }) => (
                <div key={day} className="flex items-baseline gap-3">
                  {day && <span className="text-[14px] text-[var(--zx-ink)]">{day}</span>}
                  {hours === null ? (
                    <span className="text-[14px] text-[var(--zx-muted)]">Closed</span>
                  ) : (
                    <span className="text-[14px] font-bold text-[var(--zx-ink)]">{hours}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="my-4 h-px bg-[var(--zx-line)]" />
          </>
        )}

        {/* Mark as visited */}
        <button
          type="button"
          onClick={onToggleVisited}
          className="flex w-full items-center justify-between py-1"
        >
          <span className="text-[15px] font-semibold text-[var(--zx-ink)]">
            {visited ? "Visited" : "Mark as visited"}
          </span>
          {visited ? (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "var(--zx-brand)" }}
            >
              <Check size={18} strokeWidth={2.5} color="white" />
            </span>
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border-2"
              style={{ borderColor: "var(--zx-faint)" }}
            />
          )}
        </button>
      </div>
    </>
  );
}
