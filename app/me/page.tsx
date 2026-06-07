import { ChevronRight, Lock, Orbit, QrCode, UserCog, Users, Wallet } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/zymix/avatar";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { getCurrentPersona } from "@/lib/server/auth";
import { getFriendAvatars, getZymixPersona } from "@/lib/zymix/data";

export const metadata = {
  title: "Me · ZYMIX"
};

const actionCards = [
  { emoji: "🎡", label: "Lucky Spin" },
  { emoji: "🗓️", label: "Daily Check-in" },
  { emoji: "🎁", label: "Invite & Earn" }
];

export default async function ProfilePage() {
  const persona = await getCurrentPersona(await cookies());
  if (!persona) redirect("/login");

  const zymixPersona = getZymixPersona(persona.id);
  if (!zymixPersona) redirect("/login");

  const friendAvatars = getFriendAvatars(persona.id);

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-5 pt-1">
        <h1 className="text-[34px] font-extrabold tracking-tight text-[var(--zx-ink)]">Me</h1>

        <section className="mt-5 flex items-center gap-4">
          <Avatar spec={zymixPersona.avatar} size={76} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[26px] font-extrabold leading-tight text-[var(--zx-ink)]">{zymixPersona.name}</p>
            <p className="truncate text-[16px] text-[var(--zx-muted)]">{zymixPersona.handle}</p>
          </div>
          <button
            type="button"
            aria-label="QR code"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)]"
          >
            <QrCode size={22} className="text-[var(--zx-ink)]" />
          </button>
        </section>

        <p className="mt-5 text-[16px] text-[var(--zx-muted)]">
          {zymixPersona.followers} followers · {zymixPersona.following} following
        </p>

        <section className="mt-5 flex">
          {zymixPersona.stats.map((stat, index) => (
            <div key={stat.label} className={index === 0 ? "flex-1 pr-4" : "flex-1 border-l border-[var(--zx-line)] px-4"}>
              <p className="text-[26px] font-extrabold leading-none text-[var(--zx-ink)]">{stat.value}</p>
              <p className="mt-1.5 text-[15px] text-[var(--zx-ink)]">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-7 grid grid-cols-3 gap-3">
          {actionCards.map((card) => (
            <button
              key={card.label}
              type="button"
              className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--zx-surface)] px-1 pb-4 pt-5"
            >
              <span className="text-[34px] leading-none">{card.emoji}</span>
              <span className="whitespace-nowrap text-[13px] font-semibold text-[var(--zx-ink)]">{card.label}</span>
            </button>
          ))}
        </section>

        <Link
          href="/me/bucket-list"
          className="mt-5 flex w-full items-center gap-4 rounded-2xl bg-[var(--zx-surface)] px-4 py-4"
        >
          <span className="text-[24px] leading-none">🗺️</span>
          <div className="flex-1">
            <p className="text-[18px] font-semibold text-[var(--zx-ink)]">Bucket List</p>
          </div>
          <ChevronRight size={20} className="text-[var(--zx-faint)]" />
        </Link>

        <button type="button" className="mt-5 flex w-full items-center gap-4 rounded-2xl bg-[var(--zx-surface)] px-4 py-4">
          <Wallet size={24} className="text-[var(--zx-ink)]" />
          <span className="text-[18px] font-semibold text-[var(--zx-ink)]">Wallet</span>
          <span className="ml-auto rounded-md bg-[#fdeede] px-2 py-1 text-[14px] font-bold italic text-[var(--zx-warn)]">
            Unverified
          </span>
          <ChevronRight size={20} className="text-[var(--zx-faint)]" />
        </button>

        <section className="mt-4 rounded-2xl bg-[var(--zx-surface)] px-4">
          <button type="button" className="flex w-full items-center gap-4 py-4">
            <Orbit size={24} className="text-[var(--zx-ink)]" />
            <span className="text-[18px] font-semibold text-[var(--zx-ink)]">The Mix</span>
            <ChevronRight size={20} className="ml-auto text-[var(--zx-faint)]" />
          </button>
          <div className="h-px bg-[var(--zx-line)]" />
          <button type="button" className="flex w-full items-center gap-4 py-4">
            <Users size={24} className="text-[var(--zx-ink)]" />
            <span className="text-[18px] font-semibold text-[var(--zx-ink)]">My Friends</span>
            <span className="ml-auto flex items-center -space-x-3">
              {friendAvatars.map((avatarSpec, index) => (
                <Avatar key={index} spec={avatarSpec} size={34} className="ring-2 ring-[var(--zx-surface)]" />
              ))}
            </span>
            <ChevronRight size={20} className="text-[var(--zx-faint)]" />
          </button>
        </section>

        <section className="mt-4 rounded-2xl bg-[var(--zx-surface)] px-4">
          <button type="button" className="flex w-full items-center gap-4 py-4">
            <UserCog size={24} className="text-[var(--zx-ink)]" />
            <span className="text-[18px] font-semibold text-[var(--zx-ink)]">Account</span>
            <ChevronRight size={20} className="ml-auto text-[var(--zx-faint)]" />
          </button>
          <div className="h-px bg-[var(--zx-line)]" />
          <button type="button" className="flex w-full items-center gap-4 py-4">
            <Lock size={24} className="text-[var(--zx-ink)]" />
            <span className="text-[18px] font-semibold text-[var(--zx-ink)]">Privacy</span>
            <ChevronRight size={20} className="ml-auto text-[var(--zx-faint)]" />
          </button>
        </section>

        <div className="h-4" />
      </main>

      <TabBar active="me" />
    </PhoneShell>
  );
}
