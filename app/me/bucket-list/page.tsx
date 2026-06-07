import { ChevronLeft } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { CATEGORY_META, type CategoryMeta } from "@/lib/bucket-ui";
import type { BucketCategory } from "@/lib/domain";
import { getCurrentPersona } from "@/lib/server/auth";
import { getBackendStore } from "@/lib/server/store";

export const metadata = { title: "Bucket List · ZYMIX" };

export default async function BucketListLandingPage() {
  const persona = await getCurrentPersona(await cookies());
  if (!persona) redirect("/login");

  const store = getBackendStore();
  const allItems = await store.listBucketItems({ userId: persona.id });
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

  const rowCount = Math.max(1, Math.ceil(populated.length / 2));

  return (
    <PhoneShell>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-1">
        <div className="relative flex h-8 shrink-0 items-center">
          <Link
            href="/me"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)]"
          >
            <ChevronLeft size={18} className="text-[var(--zx-ink)]" />
          </Link>
        </div>

        <div className="shrink-0 pb-3 text-center">
          <p className="text-[13px] leading-tight text-[var(--zx-muted)]">{persona.name}&apos;s</p>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[var(--zx-ink)]">
            Bucket List
          </h1>
        </div>

        {populated.length === 0 ? (
          <div className="zx-dot-paper flex-1 rounded-3xl"><EmptyState /></div>
        ) : (
          <div className="zx-dot-paper min-h-0 flex-1 rounded-[28px] px-3 py-3">
            <div
              className="grid h-full min-h-0 grid-cols-2 gap-x-3 gap-y-1"
              style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
            >
              {populated.map((cat) => (
                <StickerCard
                  key={cat}
                  cat={cat}
                  meta={CATEGORY_META[cat]}
                  count={counts.get(cat) ?? 0}
                />
              ))}
            </div>
          </div>
        )}
      </main>
      <TabBar active="me" />
    </PhoneShell>
  );
}

function StickerCard({
  cat,
  meta,
  count,
}: {
  cat: BucketCategory;
  meta: CategoryMeta;
  count: number;
}) {
  return (
    <Link
      href={`/me/bucket-list/${cat}`}
      className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-1 transition-transform active:scale-95"
    >
      {meta.sticker ? (
        <span
          className="grid min-h-0 w-full max-w-[132px] flex-1 place-items-center overflow-visible"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/stickers/${meta.sticker}.png`}
            alt={meta.name}
            className="max-h-[86%] max-w-[86%] object-contain"
            style={{ rotate: `${meta.rotation}deg` }}
          />
        </span>
      ) : (
        <span
          className="flex min-h-0 w-full max-w-[132px] flex-1 items-center justify-center text-[54px]"
          style={{ rotate: `${meta.rotation}deg` }}
        >
          {meta.emoji}
        </span>
      )}
      <span className="relative z-10 max-w-full shrink-0 rounded-full bg-[#f5efe6]/85 px-2 py-0.5 text-center">
        <p className="truncate text-[12px] font-bold leading-tight text-[var(--zx-ink)]">{meta.plural}</p>
        <p className="text-[10px] leading-tight text-[var(--zx-muted)]">
          {count} {count === 1 ? "place" : "places"}
        </p>
      </span>
    </Link>
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
      <div className="w-full rounded-2xl bg-white/70 px-4 py-4 text-left">
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
