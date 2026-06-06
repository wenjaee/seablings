import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/zymix/avatar";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import type { PersonaId } from "@/lib/domain";
import { personas } from "@/lib/fixtures";
import type { AvatarSpec } from "@/lib/zymix/data";

const PERSONA_UI: Record<PersonaId, { displayName: string; handle: string; avatar: AvatarSpec }> = {
  jeff:  { displayName: "inajeffyy", handle: "@sea_jeff",  avatar: { kind: "checker" } },
  praya: { displayName: "prayatj",   handle: "@sea_praya", avatar: { kind: "initials", initials: "P", bg: "#b04473", fg: "#fff" } },
  tana:  { displayName: "tanarae",   handle: "@sea_tana",  avatar: { kind: "initials", initials: "T", bg: "#5a7f36", fg: "#fff" } },
};

export function generateStaticParams() {
  return [{ personaId: "jeff" }, { personaId: "praya" }, { personaId: "tana" }];
}

export async function generateMetadata({ params }: { params: Promise<{ personaId: string }> }) {
  const { personaId } = await params;
  const ui = PERSONA_UI[personaId as PersonaId];
  return { title: `${ui?.displayName ?? personaId} · ZYMIX` };
}

export default async function PersonaProfilePage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;
  const persona = personas.find((p) => p.id === personaId);
  if (!persona) notFound();
  const ui = PERSONA_UI[persona.id];

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-5 pt-1">
        <h1 className="text-[34px] font-extrabold tracking-tight text-[var(--zx-ink)]">Me</h1>

        <section className="mt-5 flex items-center gap-4">
          <Avatar spec={ui.avatar} size={76} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[26px] font-extrabold leading-tight text-[var(--zx-ink)]">
              {ui.displayName}
            </p>
            <p className="truncate text-[16px] text-[var(--zx-muted)]">{ui.handle}</p>
          </div>
        </section>

        <p className="mt-5 text-[16px] text-[var(--zx-muted)]">0 followers · 0 following</p>

        <section className="mt-5 flex">
          {[
            { label: "Karma", value: 0 },
            { label: "Contributions", value: 0 },
            { label: "Account Age", value: 0 },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={
                i === 0
                  ? "flex-1 pr-4"
                  : "flex-1 border-l border-[var(--zx-line)] px-4"
              }
            >
              <p className="text-[26px] font-extrabold leading-none text-[var(--zx-ink)]">
                {stat.value}
              </p>
              <p className="mt-1.5 text-[15px] text-[var(--zx-ink)]">{stat.label}</p>
            </div>
          ))}
        </section>

        <Link
          href={`/me/${persona.id}/bucket-list`}
          className="mt-7 flex w-full items-center gap-4 rounded-2xl bg-[var(--zx-surface)] px-4 py-4"
        >
          <span className="text-[28px] leading-none">🗺️</span>
          <div className="flex-1">
            <p className="text-[16px] font-bold text-[var(--zx-ink)]">Bucket List</p>
            <p className="text-[13px] text-[var(--zx-muted)]">
              Places saved from TikTok &amp; Instagram
            </p>
          </div>
          <ChevronRight size={20} className="text-[var(--zx-faint)]" />
        </Link>

        <div className="h-6" />
      </main>
      <TabBar active="me" />
    </PhoneShell>
  );
}
