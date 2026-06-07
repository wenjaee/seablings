"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, ListChecks, Lock, LogOut, Orbit, QrCode, UserCog, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/zymix/avatar";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { getFriendAvatars } from "@/lib/zymix/data";
import { useCurrentPersona } from "./persona-session";

const actionCards = [
  { emoji: "🎡", label: "Lucky Spin" },
  { emoji: "🗓️", label: "Daily Check-in" },
  { emoji: "🎁", label: "Invite & Earn" }
];

export function ProfileScreen() {
  const router = useRouter();
  const { persona, isLoading, error, setPersona } = useCurrentPersona({ redirectToLogin: true });
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const friends = persona ? getFriendAvatars(persona.id) : [];

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to log out.");
      }

      setPersona(null);
      router.replace("/login" as Route);
    } catch (logoutRequestError) {
      setLogoutError(logoutRequestError instanceof Error ? logoutRequestError.message : "Unable to log out.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-4 pt-1 sm:px-5">
        <h1 className="text-[24px] font-extrabold tracking-tight text-[var(--zx-ink)]">Me</h1>

        {isLoading ? <p className="mt-4 text-[14px] text-[var(--zx-muted)]">Loading profile...</p> : null}
        {error ? <p className="mt-4 text-[14px] text-[#d94c3d]">{error}</p> : null}

        {persona ? (
          <>
            <section className="mt-4 flex items-center gap-3.5">
              <Avatar spec={persona.avatar} size={58} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[19px] font-extrabold leading-tight text-[var(--zx-ink)]">{persona.name}</p>
                <p className="truncate text-[13px] text-[var(--zx-muted)]">{persona.handle}</p>
              </div>
              <button
                type="button"
                aria-label="QR code"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--zx-surface)]"
              >
                <QrCode size={18} className="text-[var(--zx-ink)]" />
              </button>
            </section>

            <p className="mt-3 text-[13px] text-[var(--zx-muted)]">
              {persona.followers} followers · {persona.following} following
            </p>

            <section className="mt-4 flex">
              {persona.stats.map((stat, index) => (
                <div key={stat.label} className={index === 0 ? "flex-1 pr-4" : "flex-1 border-l border-[var(--zx-line)] px-4"}>
                  <p className="text-[17px] font-extrabold leading-none text-[var(--zx-ink)]">{stat.value}</p>
                  <p className="mt-1 text-[12px] text-[var(--zx-ink)]">{stat.label}</p>
                </div>
              ))}
            </section>

            <section className="mt-5 grid grid-cols-3 gap-2.5">
              {actionCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl bg-[var(--zx-surface)] px-1 py-3"
                >
                  <span className="text-[23px] leading-none">{card.emoji}</span>
                  <span className="max-w-full truncate text-[11px] font-semibold text-[var(--zx-ink)]">{card.label}</span>
                </button>
              ))}
            </section>

            <button type="button" className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-[var(--zx-surface)] px-3.5 py-3">
              <Wallet size={19} className="text-[var(--zx-ink)]" />
              <span className="text-[14px] font-semibold text-[var(--zx-ink)]">Wallet</span>
              <span className="ml-auto rounded-md bg-[#fdeede] px-2 py-0.5 text-[12px] font-bold italic text-[var(--zx-warn)]">
                {persona.walletVerified ? "Verified" : "Unverified"}
              </span>
              <ChevronRight size={18} className="text-[var(--zx-faint)]" />
            </button>

            <Link
              href={"/me/bucket-list" as Route}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[var(--zx-surface)] px-3.5 py-3"
            >
              <ListChecks size={19} className="text-[var(--zx-ink)]" />
              <span className="text-[14px] font-semibold text-[var(--zx-ink)]">Bucket List</span>
              <ChevronRight size={18} className="ml-auto text-[var(--zx-faint)]" />
            </Link>

            <section className="mt-3 rounded-2xl bg-[var(--zx-surface)] px-3.5">
              <button type="button" className="flex w-full items-center gap-3.5 py-3.5">
                <Orbit size={19} className="text-[var(--zx-ink)]" />
                <span className="text-[14px] font-semibold text-[var(--zx-ink)]">The Mix</span>
                <ChevronRight size={20} className="ml-auto text-[var(--zx-faint)]" />
              </button>
              <div className="h-px bg-[var(--zx-line)]" />
              <button type="button" className="flex w-full items-center gap-3.5 py-3.5">
                <Users size={19} className="text-[var(--zx-ink)]" />
                <span className="text-[14px] font-semibold text-[var(--zx-ink)]">My Friends</span>
                <span className="ml-auto flex items-center -space-x-3">
                  {friends.map((friend, index) => (
                    <Avatar key={index} spec={friend} size={28} className="ring-2 ring-[var(--zx-surface)]" />
                  ))}
                </span>
                <ChevronRight size={18} className="text-[var(--zx-faint)]" />
              </button>
            </section>

            <section className="mt-3 rounded-2xl bg-[var(--zx-surface)] px-3.5">
              <button type="button" className="flex w-full items-center gap-3.5 py-3.5">
                <UserCog size={19} className="text-[var(--zx-ink)]" />
                <span className="text-[14px] font-semibold text-[var(--zx-ink)]">Account</span>
                <ChevronRight size={20} className="ml-auto text-[var(--zx-faint)]" />
              </button>
              <div className="h-px bg-[var(--zx-line)]" />
              <button type="button" className="flex w-full items-center gap-3.5 py-3.5">
                <Lock size={19} className="text-[var(--zx-ink)]" />
                <span className="text-[14px] font-semibold text-[var(--zx-ink)]">Privacy</span>
                <ChevronRight size={18} className="ml-auto text-[var(--zx-faint)]" />
              </button>
            </section>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[#ffd8d3] bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[#d94c3d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={16} />
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>

            {logoutError ? <p className="mt-3 text-center text-[13px] text-[#d94c3d]">{logoutError}</p> : null}
          </>
        ) : null}

        <div className="h-4" />
      </main>

      <TabBar active="me" />
    </PhoneShell>
  );
}
