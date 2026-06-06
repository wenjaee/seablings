import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import clsx from "clsx";

import type { Persona, PersonaId } from "@/lib/domain";

type PanelProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

type PersonaTabsProps = {
  personas: Persona[];
  currentPath: string;
};

type PillProps = {
  children: ReactNode;
  tone?: "default" | "accent" | "warm" | "muted";
  className?: string;
};

export function Panel({ title, eyebrow, action, children, className }: PanelProps) {
  return (
    <section
      className={clsx(
        "rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_16px_40px_rgba(32,32,32,0.06)]",
        className
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{eyebrow}</p> : null}
          <h2 className="mt-1 text-base font-semibold text-[var(--ink)]">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function PersonaTabs({ personas, currentPath }: PersonaTabsProps) {
  return (
    <nav aria-label="Demo personas" className="flex flex-wrap gap-2">
      {personas.map((persona) => {
        const href = `/demo/${persona.id}` as Route;
        const isActive = currentPath === href;

        return (
          <Link
            key={persona.id}
            href={href}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-transparent text-white shadow-sm"
                : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:border-[var(--accent)]"
            )}
            style={isActive ? { backgroundColor: persona.color } : undefined}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
            {persona.name}
          </Link>
        );
      })}
      <Link
        href="/demo/control"
        className={clsx(
          "inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium transition-colors",
          currentPath === "/demo/control"
            ? "border-[var(--ink)] bg-[var(--ink)] text-white"
            : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:border-[var(--ink)]"
        )}
      >
        Control
      </Link>
    </nav>
  );
}

export function Pill({ children, tone = "default", className }: PillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        tone === "default" && "bg-[#edf2f0] text-[var(--ink)]",
        tone === "accent" && "bg-[#e5f4f1] text-[var(--accent-strong)]",
        tone === "warm" && "bg-[#fff0df] text-[#9a4b1f]",
        tone === "muted" && "bg-[#eef1f4] text-[var(--muted)]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PersonaDot({ persona }: { persona: Persona }) {
  return <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: persona.color }} />;
}

export function isPersonaRoute(pathname: string, personaId: PersonaId): boolean {
  return pathname === `/demo/${personaId}`;
}
