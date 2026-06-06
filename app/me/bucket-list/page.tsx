import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { CATEGORY_META } from "@/lib/bucket-ui";
import type { BucketCategory } from "@/lib/domain";
import { getBackendStore } from "@/lib/server/store";

export const metadata = { title: "Bucket List · ZYMIX" };

// TODO: replace with session.userId once auth lands
const CURRENT_USER_ID = "jeff" as const;

export default async function BucketListLandingPage() {
  const store = getBackendStore();
  const allItems = await store.listBucketItems({ userId: CURRENT_USER_ID });
  const visible = allItems.filter(
    (item) => item.status === "saved" || item.status === "completed",
  );

  const counts = new Map<BucketCategory, number>();
  for (const item of visible) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  const populated = (Object.keys(CATEGORY_META) as BucketCategory[]).filter(
    (cat) => (counts.get(cat) ?? 0) > 0,
  );

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-5 pt-1">
        <div className="flex items-center gap-3 pb-3 pt-1">
          <Link
            href="/me"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)]"
          >
            <ChevronLeft size={18} className="text-[var(--zx-ink)]" />
          </Link>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zx-ink)]">
            Bucket List
          </h1>
        </div>

        {populated.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <p className="mb-4 text-[13px] text-[var(--zx-muted)]">
              {visible.length} {visible.length === 1 ? "place" : "places"} saved
            </p>
            <div className="grid grid-cols-3 gap-3">
              {populated.map((cat) => {
                const meta = CATEGORY_META[cat];
                const count = counts.get(cat) ?? 0;
                return (
                  <Link
                    key={cat}
                    href={`/me/bucket-list/${cat}`}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--zx-surface)] px-2 pb-3 pt-4 transition-transform active:scale-95"
                  >
                    <span className="text-[34px] leading-none">{meta.emoji}</span>
                    <span className="text-[11px] font-bold text-[var(--zx-ink)]">
                      {meta.name}
                    </span>
                    <span className="text-[10px] text-[var(--zx-muted)]">
                      {count} {count === 1 ? "place" : "places"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <div className="h-6" />
      </main>
      <TabBar active="me" />
    </PhoneShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <span className="text-[64px] leading-none">🗺️</span>
      <h2 className="text-[20px] font-extrabold text-[var(--zx-ink)]">Nothing here yet</h2>
      <p className="text-[14px] leading-relaxed text-[var(--zx-muted)]">
        Places are added automatically when you share a TikTok or Instagram video through
        the SEAblings share extension.
      </p>
      <div className="w-full rounded-2xl bg-[var(--zx-surface)] px-4 py-4 text-left">
        <p className="mb-2 text-[13px] font-bold text-[var(--zx-ink)]">How it works</p>
        <ol className="list-inside list-decimal space-y-1.5 text-[13px] text-[var(--zx-muted)]">
          <li>Share a TikTok or Instagram video</li>
          <li>
            Tap{" "}
            <span className="font-semibold text-[var(--zx-brand-deep)]">SEAblings</span> in the
            share sheet
          </li>
          <li>We extract and save the place automatically</li>
        </ol>
      </div>
    </div>
  );
}
