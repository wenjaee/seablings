import Link from "next/link";
import type { Route } from "next";
import { BadgeCheck, Bell, ChevronRight, Plus, Search } from "lucide-react";

import { Avatar } from "@/components/zymix/avatar";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { conversations } from "@/lib/zymix/data";

export const metadata = {
  title: "ZYMIX"
};

export default function HomePage() {
  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-5 pt-2">
        <svg width={0} height={0} className="absolute">
          <defs>
            <linearGradient id="zxBell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#cdeb4e" />
              <stop offset="1" stopColor="#2bc23a" />
            </linearGradient>
          </defs>
        </svg>

        <div className="flex items-center justify-between">
          <h1 className="text-[30px] font-black tracking-tight text-[var(--zx-ink)]">ZYMIX</h1>
          <button
            type="button"
            aria-label="New"
            className="relative grid h-12 w-12 place-items-center rounded-full bg-white shadow-[0_8px_22px_rgba(0,0,0,0.12)]"
          >
            <Plus size={24} className="text-[var(--zx-ink)]" />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[var(--zx-brand)] ring-2 ring-white" />
          </button>
        </div>

        <button type="button" className="mt-5 flex w-full items-center gap-3">
          <Bell size={32} strokeWidth={1.6} stroke="url(#zxBell)" fill="url(#zxBell)" />
          <span className="text-[19px] font-bold text-[var(--zx-ink)]">Activity</span>
          <ChevronRight size={20} className="ml-auto text-[var(--zx-faint)]" />
        </button>

        <div className="mt-4 flex items-center gap-2.5 rounded-full bg-[var(--zx-surface)] px-4 py-3">
          <Search size={20} className="text-[var(--zx-muted)]" />
          <span className="text-[16px] text-[var(--zx-muted)]">Search</span>
        </div>

        <div className="mt-3">
          {conversations.map((conv) => (
            <Link key={conv.id} href={`/chat/${conv.id}` as Route} className="flex items-center gap-3.5 active:opacity-70">
              <Avatar spec={conv.avatar} size={56} />
              <div className="flex min-w-0 flex-1 items-start gap-2 border-b border-[var(--zx-line)] py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[17px] font-bold text-[var(--zx-ink)]">{conv.name}</span>
                    {conv.verified ? (
                      <BadgeCheck size={18} className="shrink-0" fill="var(--zx-brand)" stroke="#ffffff" strokeWidth={2.4} aria-hidden />
                    ) : null}
                  </div>
                  {conv.members ? <p className="mt-0.5 truncate text-[14px] text-[var(--zx-muted)]">{conv.members}</p> : null}
                  <p className="mt-0.5 truncate text-[14px] text-[var(--zx-muted)]">
                    {conv.preview} · {conv.time}
                  </p>
                </div>
                {conv.unread ? (
                  <span className="mt-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[var(--zx-danger)] px-1.5 text-[12px] font-bold text-white">
                    {conv.unread}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>

        <div className="h-4" />
      </main>

      <TabBar active="chat" />
    </PhoneShell>
  );
}
