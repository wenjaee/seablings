import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BucketListView } from "@/components/zymix/bucket-list-view";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { CATEGORY_META } from "@/lib/bucket-ui";
import type { BucketCategory, PersonaId } from "@/lib/domain";
import { personas } from "@/lib/fixtures";
import { getBackendStore } from "@/lib/server/store";

export default async function CategoryListPage({
  params,
}: {
  params: Promise<{ personaId: string; category: string }>;
}) {
  const { personaId, category } = await params;
  const persona = personas.find((p) => p.id === personaId);
  if (!persona) notFound();

  const meta = CATEGORY_META[category as BucketCategory];
  if (!meta) notFound();

  const store = getBackendStore();
  const allItems = await store.listBucketItems({ userId: persona.id as PersonaId });
  const items = allItems
    .filter(
      (item) =>
        item.category === category &&
        (item.status === "saved" || item.status === "completed"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-5 pt-1">
        <div className="flex items-center gap-3 pb-2 pt-1">
          <Link
            href={`/me/${persona.id}/bucket-list`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)]"
          >
            <ChevronLeft size={18} className="text-[var(--zx-ink)]" />
          </Link>
          <span className="text-[22px] leading-none">{meta.emoji}</span>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zx-ink)]">
            {meta.name}
          </h1>
          <span className="ml-auto text-[13px] text-[var(--zx-muted)]">
            {items.length} {items.length === 1 ? "place" : "places"}
          </span>
        </div>

        <BucketListView items={items} />

        <div className="h-6" />
      </main>
      <TabBar active="me" />
    </PhoneShell>
  );
}
