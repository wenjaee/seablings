"use client";

import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Clock3, ExternalLink, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";

import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { useCurrentPersona } from "@/components/zymix/persona-session";
import type { BucketItem, BucketItemStatus } from "@/lib/domain";
import { seededBucketItems } from "@/lib/fixtures";
import { isSeededPersonaId } from "@/lib/zymix/data";

const steps = [
  "Find a place video on TikTok or Instagram",
  "Share it to Zymix",
  "It appears here instantly, categorised and enriched"
];

type BucketListTaxonomyCategory =
  | "bakery"
  | "cafe"
  | "restaurant"
  | "bar"
  | "nightlife"
  | "activity"
  | "culture"
  | "shopping"
  | "other";

type CategoryTile = {
  key: BucketListTaxonomyCategory;
  name: string;
  emoji: string;
};

const categories: CategoryTile[] = [
  { key: "bakery", name: "Bakery", emoji: "🥐" },
  { key: "cafe", name: "Cafe", emoji: "☕" },
  { key: "restaurant", name: "Restaurant", emoji: "🍽️" },
  { key: "bar", name: "Bar", emoji: "🍸" },
  { key: "nightlife", name: "Nightlife", emoji: "🌙" },
  { key: "activity", name: "Activity", emoji: "🎾" },
  { key: "culture", name: "Culture", emoji: "🎭" },
  { key: "shopping", name: "Shopping", emoji: "🛍️" },
  { key: "other", name: "Other", emoji: "✨" }
];

const categoryByKey = categories.reduce<Record<BucketListTaxonomyCategory, CategoryTile>>(
  (acc, tile) => {
    acc[tile.key] = tile;
    return acc;
  },
  {} as Record<BucketListTaxonomyCategory, CategoryTile>
);

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const categoryDisplayMap: Record<string, BucketListTaxonomyCategory> = {
  bakery: "bakery",
  cafe: "cafe",
  restaurant: "restaurant",
  bar: "bar",
  nightlife: "nightlife",
  activity: "activity",
  culture: "culture",
  shopping: "shopping",
  other: "other",
  eats: "restaurant",
  drinks: "bar",
  market: "shopping",
  hidden_gem: "other"
};

function normalizeCategory(category: string): BucketListTaxonomyCategory {
  return categoryDisplayMap[category] ?? "other";
}

function getCategoryCounts(items: BucketItem[]) {
  return items.reduce<Partial<Record<BucketListTaxonomyCategory, number>>>((counts, item) => {
    const category = normalizeCategory(item.category);
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
}

function BucketListHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  const icon = <ArrowLeft size={20} className="text-[var(--zx-ink)]" />;
  return (
    <div className="flex items-center gap-3 py-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)] active:opacity-70"
        >
          {icon}
        </button>
      ) : (
        <Link
          href="/me"
          aria-label="Back to profile"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)] active:opacity-70"
        >
          {icon}
        </Link>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-extrabold tracking-tight text-[var(--zx-ink)]">{title}</h1>
        {subtitle ? <p className="truncate text-[13px] text-[var(--zx-muted)]">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function EmptyBucketList() {
  return (
    <section className="flex flex-col items-center px-3 pb-10 pt-10 text-center">
      <div className="text-[60px] leading-none" aria-hidden>
        🗺️
      </div>
      <h2 className="mt-4 text-[22px] font-extrabold tracking-tight text-[var(--zx-ink)]">No places yet</h2>
      <p className="mt-3 max-w-[300px] text-[15px] leading-6 text-[var(--zx-muted)]">
        Share a TikTok or Instagram video to Zymix - your places are saved automatically.
      </p>

      <div className="mt-5 w-full rounded-2xl bg-[var(--zx-surface)] px-4 py-4 text-left">
        <div className="text-[14px] font-semibold text-[var(--zx-brand-deep)]">✦ How it works</div>
      </div>

      <div className="mt-4 w-full">
        {steps.map((step, index) => (
          <div key={step} className="flex items-start gap-3 border-b border-[var(--zx-line)] py-3 last:border-b-0">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--zx-brand)] text-[12px] font-extrabold text-[#1a4000]">
              {index + 1}
            </span>
            <p className="text-left text-[14px] leading-6 text-[var(--zx-muted)]">{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryOverview({
  items,
  onSelect
}: {
  items: BucketItem[];
  onSelect: (key: BucketListTaxonomyCategory) => void;
}) {
  const categoryCounts = getCategoryCounts(items);
  const activeCategories = categories.filter((category) => (categoryCounts[category.key] ?? 0) > 0);
  const activeCategoryCount = activeCategories.length;

  return (
    <section className="pb-8 pt-2">
      <p className="mb-4 text-[15px] font-medium text-[var(--zx-muted)]">
        {pluralize(items.length, "place")} · {pluralize(activeCategoryCount, "category", "categories")}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {activeCategories.map((category) => {
          const count = categoryCounts[category.key] ?? 0;

          return (
            <button
              key={category.key}
              type="button"
              onClick={() => onSelect(category.key)}
              className="relative flex min-h-[118px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-[var(--zx-surface)] px-2 py-4 active:scale-[0.98]"
            >
              <span className="absolute right-2 top-2 rounded-full bg-[var(--zx-brand)] px-2 py-0.5 text-[11px] font-extrabold text-[#1a4000]">
                {count}
              </span>
              <span className="text-[34px] leading-none" aria-hidden>
                {category.emoji}
              </span>
              <span className="text-center text-[12px] font-bold text-[var(--zx-ink)]">{category.name}</span>
              <span className="text-center text-[11px] font-medium text-[var(--zx-faint)]">{pluralize(count, "place")}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ChecklistRow({
  item,
  onOpen,
  onToggleVisited,
  isLast
}: {
  item: BucketItem;
  onOpen: (item: BucketItem) => void;
  onToggleVisited: (item: BucketItem) => void;
  isLast: boolean;
}) {
  const visited = item.status === "completed";

  return (
    <div className={`flex items-center gap-3 px-3 py-3 ${isLast ? "" : "border-b border-[var(--zx-line)]"}`}>
      <button
        type="button"
        onClick={() => onToggleVisited(item)}
        aria-label={visited ? `Mark ${item.title} as not visited` : `Mark ${item.title} as visited`}
        aria-pressed={visited}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 active:scale-95 ${
          visited ? "border-[var(--zx-brand-deep)] bg-[var(--zx-brand)]" : "border-[var(--zx-faint)] bg-white"
        }`}
      >
        {visited ? <Check size={16} strokeWidth={3} className="text-[#1a4000]" /> : null}
      </button>

      <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="text-[22px] leading-none" aria-hidden>
          {categoryByKey[normalizeCategory(item.category)].emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[15px] font-bold ${
              visited ? "text-[var(--zx-faint)] line-through" : "text-[var(--zx-ink)]"
            }`}
          >
            {item.title}
          </span>
          <span className="block truncate text-[13px] text-[var(--zx-muted)]">
            {item.neighborhood} · {item.priceEstimate}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-[var(--zx-faint)]" />
      </button>
    </div>
  );
}

function CategoryDetail({
  items,
  onOpen,
  onToggleVisited
}: {
  items: BucketItem[];
  onOpen: (item: BucketItem) => void;
  onToggleVisited: (item: BucketItem) => void;
}) {
  if (items.length === 0) {
    return <p className="pt-6 text-[15px] text-[var(--zx-muted)]">Nothing here yet.</p>;
  }

  const visitedCount = items.filter((item) => item.status === "completed").length;

  return (
    <section className="pb-8 pt-1">
      <p className="mb-3 text-[15px] font-medium text-[var(--zx-muted)]">
        {pluralize(items.length, "place")}
        {visitedCount > 0 ? ` · ${visitedCount} visited` : ""}
      </p>
      <div className="overflow-hidden rounded-2xl bg-[var(--zx-surface)]">
        {items.map((item, index) => (
          <ChecklistRow
            key={item.id}
            item={item}
            onOpen={onOpen}
            onToggleVisited={onToggleVisited}
            isLast={index === items.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function DetailSheet({
  item,
  onClose,
  onToggleVisited
}: {
  item: BucketItem;
  onClose: () => void;
  onToggleVisited: (item: BucketItem) => void;
}) {
  const visited = item.status === "completed";
  const meta = categoryByKey[normalizeCategory(item.category)];

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="zx-backdrop-enter absolute inset-0 bg-black/40"
      />
      <div className="zx-sheet-enter zx-hide-scroll relative max-h-[88%] overflow-y-auto rounded-t-3xl bg-white px-5 pb-7 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--zx-line)]" />

        <div className="flex items-start gap-3">
          <span className="text-[34px] leading-none" aria-hidden>
            {meta.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-[var(--zx-ink)]">{item.title}</h2>
            <p className="mt-0.5 text-[13px] text-[var(--zx-muted)]">
              {meta.name} · {item.priceEstimate}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)] active:opacity-70"
          >
            <X size={18} className="text-[var(--zx-ink)]" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[13px] text-[var(--zx-muted)]">
          <MapPin size={14} className="shrink-0" />
          <span className="truncate">{item.address ?? item.neighborhood}</span>
        </div>

        {item.openingHours ? (
          <div className="mt-2 flex items-start gap-1.5 text-[13px] text-[var(--zx-muted)]">
            <Clock3 size={14} className="mt-0.5 shrink-0" />
            <span>{item.openingHours}</span>
          </div>
        ) : null}

        {item.description ? (
          <p className="mt-3 text-[14px] leading-6 text-[var(--zx-ink)]">{item.description}</p>
        ) : null}

        {item.whyInteresting ? (
          <div className="mt-3 rounded-2xl bg-[var(--zx-brand-soft)] px-4 py-3">
            <p className="text-[13px] font-semibold text-[var(--zx-brand-deep)]">Why it&apos;s worth it</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--zx-ink)]">{item.whyInteresting}</p>
          </div>
        ) : null}

        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--zx-brand-deep)]"
          >
            <ExternalLink size={14} /> View source
          </a>
        ) : null}

        <button
          type="button"
          onClick={() => onToggleVisited(item)}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-extrabold active:scale-[0.99] ${
            visited ? "bg-[var(--zx-surface)] text-[var(--zx-ink)]" : "bg-[var(--zx-brand)] text-[#1a4000]"
          }`}
        >
          <Check size={18} strokeWidth={3} /> {visited ? "Visited" : "Mark as visited"}
        </button>
      </div>
    </div>
  );
}

async function fetchBucketItems(userId: string) {
  const response = await fetch(`/api/bucket-items?userId=${encodeURIComponent(userId)}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to load saved places.");
  }

  const payload = (await response.json().catch(() => null)) as { items?: BucketItem[] } | null;
  const all = Array.isArray(payload?.items) ? payload.items : [];
  return all.filter((item) => item.status === "saved" || item.status === "completed");
}

type BucketListScreenProps = {
  items?: BucketItem[];
};

export function BucketListScreen({ items }: BucketListScreenProps) {
  const { persona, isLoading, error } = useCurrentPersona({ redirectToLogin: true });
  const [list, setList] = useState<BucketItem[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(items === undefined);
  const [selectedCategory, setSelectedCategory] = useState<BucketListTaxonomyCategory | null>(null);
  const [detailItem, setDetailItem] = useState<BucketItem | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadItems() {
      if (items !== undefined) {
        setList(items);
        setItemsError(null);
        setIsLoadingItems(false);
        return;
      }

      if (!persona) {
        setList([]);
        setIsLoadingItems(false);
        return;
      }

      if (!isSeededPersonaId(persona.id)) {
        setList([]);
        setItemsError(null);
        setIsLoadingItems(false);
        return;
      }

      setIsLoadingItems(true);
      setItemsError(null);

      try {
        const nextItems = await fetchBucketItems(persona.id);
        if (!isActive) {
          return;
        }

        setList(nextItems);
      } catch {
        if (!isActive) {
          return;
        }

        setList(
          seededBucketItems.filter(
            (item) => item.userId === persona.id && (item.status === "saved" || item.status === "completed")
          )
        );
        setItemsError("Showing seeded saved places until the session-backed API is available.");
      } finally {
        if (isActive) {
          setIsLoadingItems(false);
        }
      }
    }

    void loadItems();

    return () => {
      isActive = false;
    };
  }, [items, persona]);

  async function handleToggleVisited(item: BucketItem) {
    const nextStatus: BucketItemStatus = item.status === "completed" ? "saved" : "completed";

    // Optimistic update of both the list and (if open) the detail sheet.
    setList((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, status: nextStatus } : entry)));
    setDetailItem((prev) => (prev && prev.id === item.id ? { ...prev, status: nextStatus } : prev));

    try {
      const response = await fetch(`/api/bucket-items/${encodeURIComponent(item.id)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        throw new Error("Unable to update status.");
      }
    } catch {
      // Revert on failure.
      setList((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, status: item.status } : entry)));
      setDetailItem((prev) => (prev && prev.id === item.id ? { ...prev, status: item.status } : prev));
    }
  }

  const categoryItems = selectedCategory
    ? list.filter((item) => normalizeCategory(item.category) === selectedCategory)
    : [];
  const activeMeta = selectedCategory ? categoryByKey[selectedCategory] : null;
  const showBody = !isLoadingItems && Boolean(persona);

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-5 pt-2">
        {selectedCategory && activeMeta ? (
          <BucketListHeader
            title={`${activeMeta.emoji} ${activeMeta.name}`}
            subtitle={pluralize(categoryItems.length, "place")}
            onBack={() => setSelectedCategory(null)}
          />
        ) : (
          <BucketListHeader title="Bucket list" subtitle={persona ? `${persona.name}'s saved places` : undefined} />
        )}

        {isLoading ? <p className="pt-6 text-[15px] text-[var(--zx-muted)]">Loading your session...</p> : null}
        {error ? <p className="pt-6 text-[15px] text-[#d94c3d]">{error}</p> : null}
        {itemsError ? <p className="pb-2 pt-3 text-[14px] text-[var(--zx-muted)]">{itemsError}</p> : null}
        {isLoadingItems ? <p className="pt-6 text-[15px] text-[var(--zx-muted)]">Loading saved places...</p> : null}

        {showBody ? (
          selectedCategory ? (
            <CategoryDetail items={categoryItems} onOpen={setDetailItem} onToggleVisited={handleToggleVisited} />
          ) : list.length > 0 ? (
            <CategoryOverview items={list} onSelect={setSelectedCategory} />
          ) : (
            <EmptyBucketList />
          )
        ) : null}
      </main>

      <TabBar active="me" />

      {detailItem ? (
        <DetailSheet item={detailItem} onClose={() => setDetailItem(null)} onToggleVisited={handleToggleVisited} />
      ) : null}
    </PhoneShell>
  );
}
