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

  const left  = populated.filter((_, i) => i % 2 === 0);
  const right = populated.filter((_, i) => i % 2 === 1);

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto bg-[#f5efe6] px-4 pt-1">
        <div className="relative flex items-center py-3">
          <Link
            href="/me"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/70"
          >
            <ChevronLeft size={18} className="text-[var(--zx-ink)]" />
          </Link>
        </div>

        <div className="pb-6 text-center">
          <p className="text-[14px] text-[var(--zx-muted)]">{persona.name}&apos;s</p>
          <h1 className="text-[32px] font-extrabold tracking-tight text-[var(--zx-ink)]">
            Bucket List
          </h1>
        </div>

        {populated.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex gap-3 pb-8">
            <div className="flex flex-1 flex-col gap-6">
              {left.map((cat) => (
                <StickerCard
                  key={cat}
                  cat={cat}
                  meta={CATEGORY_META[cat]}
                  count={counts.get(cat) ?? 0}
                />
              ))}
            </div>
            <div className="mt-20 flex flex-1 flex-col gap-6">
              {right.map((cat) => (
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
      className="flex flex-col items-center gap-2 transition-transform active:scale-95"
    >
      <div
        className="rounded-2xl bg-white p-3 shadow-md"
        style={{ rotate: `${meta.rotation}deg` }}
      >
        {meta.sticker ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/stickers/${meta.sticker}.png`}
            alt={meta.name}
            className="h-[120px] w-[120px] object-contain"
          />
        ) : (
          <span className="flex h-[120px] w-[120px] items-center justify-center text-[56px]">
            {meta.emoji}
          </span>
        )}
      </div>
      <p className="text-[12px] font-bold text-[var(--zx-ink)]">{meta.name}</p>
      <p className="text-[11px] text-[var(--zx-muted)]">
        {count} {count === 1 ? "place" : "places"}
      </p>
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
