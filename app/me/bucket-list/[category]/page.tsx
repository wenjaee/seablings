import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BucketListView } from "@/components/zymix/bucket-list-view";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { CATEGORY_META } from "@/lib/bucket-ui";
import type { BucketCategory } from "@/lib/domain";
import { getCurrentPersona } from "@/lib/server/auth";
import { getBackendStore } from "@/lib/server/store";

export default async function CategoryListPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const persona = await getCurrentPersona(await cookies());
  if (!persona) redirect("/login");

  const { category } = await params;

  const meta = CATEGORY_META[category as BucketCategory];
  if (!meta) notFound();

  const store = getBackendStore();
  const allItems = await store.listBucketItems({ userId: persona.id });
  const items = allItems
    .filter(
      (item) =>
        item.category === category &&
        (item.status === "saved" || item.status === "completed"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-x-hidden overflow-y-auto px-5 pt-1">
        <div className="flex min-w-0 items-center gap-3 pb-5 pt-1">
          <Link
            href={"/me/bucket-list" as Route}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)]"
          >
            <ChevronLeft size={18} className="text-[var(--zx-ink)]" />
          </Link>
          <span className="text-[22px] leading-none">{meta.emoji}</span>
          <h1 className="min-w-0 flex-1 break-words text-[22px] font-extrabold tracking-tight text-[var(--zx-ink)]">
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
