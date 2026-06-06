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
};

const TABS: TabDef[] = [
  { key: "chat", icon: MessageCircle, href: "/", badge: 3 },
  { key: "discover", icon: Orbit },
  { key: "play", icon: CirclePlay },
  { key: "apps", icon: LayoutGrid },
  { key: "me", icon: User, href: "/me" }
];

export function TabBar({ active }: { active: TabKey }) {
  return (
    <div className="shrink-0 px-3 pt-1" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <nav className="flex items-center justify-between rounded-full border border-black/5 bg-white px-1.5 py-1.5 shadow-[0_12px_34px_rgba(0,0,0,0.14)]">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          const inner = (
            <span
              className={clsx(
                "relative inline-flex items-center justify-center rounded-full transition-colors",
                isActive ? "bg-[var(--zx-brand-soft)] px-5 py-2.5" : "px-3.5 py-2.5"
              )}
            >
              <Icon size={24} strokeWidth={2} className={isActive ? "text-[var(--zx-brand-deep)]" : "text-[var(--zx-ink)]"} />
              {tab.badge ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--zx-danger)] px-1 text-[11px] font-bold leading-none text-white">
                  {tab.badge}
                </span>
              ) : null}
            </span>
          );

          return tab.href ? (
            <Link key={tab.key} href={tab.href as Route} aria-label={tab.key} className="flex flex-1 justify-center">
              {inner}
            </Link>
          ) : (
            <button key={tab.key} type="button" aria-label={tab.key} className="flex flex-1 justify-center">
              {inner}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
