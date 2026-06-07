import Link from "next/link";
import type { Route } from "next";
import clsx from "clsx";
import { CirclePlay, LayoutGrid, MessageCircle, Orbit, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type TabKey = "chat" | "discover" | "play" | "apps" | "me";

type TabDef = {
  key: TabKey;
  icon: LucideIcon;
  href?: "/" | "/me";
  badge?: number;
  disabled?: boolean;
};

const TABS: TabDef[] = [
  { key: "chat", icon: MessageCircle, href: "/" },
  { key: "discover", icon: Orbit, disabled: true },
  { key: "play", icon: CirclePlay, disabled: true },
  { key: "apps", icon: LayoutGrid, disabled: true },
  { key: "me", icon: User, href: "/me" }
];

export function TabBar({ active }: { active: TabKey }) {
  return (
    <div className="shrink-0 px-2 pt-1 sm:px-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <nav className="grid grid-cols-5 items-center rounded-full border border-black/5 bg-white px-1 py-1 shadow-[0_12px_34px_rgba(0,0,0,0.14)]">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          const inner = (
            <span
              className={clsx(
                "relative inline-flex items-center justify-center rounded-full transition-colors",
                isActive ? "bg-[var(--zx-brand-soft)] px-2.5 py-1.5" : "px-2 py-1.5"
              )}
            >
              <Icon size={21} strokeWidth={2} className={isActive ? "text-[var(--zx-brand-deep)]" : "text-[var(--zx-ink)]"} />
              {tab.badge ? (
                <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--zx-danger)] px-1 text-[10px] font-bold leading-none text-white">
                  {tab.badge}
                </span>
              ) : null}
            </span>
          );

          return tab.href ? (
            <Link key={tab.key} href={tab.href as Route} aria-label={tab.key} className="flex min-w-0 justify-center">
              {inner}
            </Link>
          ) : (
            <button
              key={tab.key}
              type="button"
              aria-label={tab.key}
              disabled={tab.disabled}
              className="flex min-w-0 justify-center disabled:pointer-events-none disabled:opacity-40"
            >
              {inner}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
