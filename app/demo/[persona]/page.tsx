import Link from "next/link";
import { ArrowLeft, Compass, MessageCircleMore, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";

import { BucketPanel } from "@/components/demo/bucket-panel";
import { ChatThread } from "@/components/demo/chat-thread";
import { CriteriaPanel, RecommendationPanel } from "@/components/demo/planner-panels";
import { Panel, PersonaTabs, Pill } from "@/components/demo/primitives";
import type { PersonaId } from "@/lib/domain";
import {
  demoPersonas,
  getBucketItemsForPersona,
  getCriteria,
  getPersona,
  getRecommendations,
  timelineMessages
} from "@/lib/demo/data";
import { seededCriteria } from "@/lib/fixtures";

const personaIds = new Set(demoPersonas.map((persona) => persona.id));

export function generateStaticParams() {
  return demoPersonas.map((persona) => ({
    persona: persona.id
  }));
}

export default async function PersonaDemoPage({
  params
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;

  if (!personaIds.has(persona as PersonaId)) {
    notFound();
  }

  const currentPersonaId = persona as PersonaId;
  const currentPersona = getPersona(currentPersonaId);
  const bucketItems = getBucketItemsForPersona(currentPersonaId);
  const currentCriteria = getCriteria(currentPersonaId);
  const recommendations = getRecommendations();

  return (
    <main className="min-h-dvh bg-[#eef4f2] px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-4 shadow-[0_18px_44px_rgba(32,32,32,0.06)] sm:px-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] hover:border-[var(--ink)]"
              >
                <ArrowLeft size={15} aria-hidden="true" />
                Home
              </Link>
              <PersonaTabs personas={demoPersonas} currentPath={`/demo/${currentPersonaId}`} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: currentPersona.color }}
                  />
                  <Pill tone="accent">Mobile persona</Pill>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">{currentPersona.name}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Zymix-style group planning view seeded from local fixtures, with personal spots and planner output.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:min-w-[280px]">
                <div className="rounded-lg bg-[#e5f4f1] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Budget</p>
                  <p className="mt-1 text-base font-semibold text-[var(--ink)]">GBP {currentCriteria.budgetMax}</p>
                </div>
                <div className="rounded-lg bg-[#fff0df] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Postcode</p>
                  <p className="mt-1 text-base font-semibold text-[var(--ink)]">{currentCriteria.postalCode}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="space-y-4">
            <Panel
              eyebrow="Group thread"
              title="Weekend plan chat"
              action={
                <div className="inline-flex items-center gap-2 rounded-full bg-[#f4efe4] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink)]">
                  <MessageCircleMore size={14} aria-hidden="true" />
                  @planner live
                </div>
              }
            >
              <ChatThread currentPersonaId={currentPersonaId} messages={timelineMessages} />
            </Panel>

            <RecommendationPanel recommendations={recommendations} currentPersonaId={currentPersonaId} />
          </div>

          <div className="space-y-4">
            <Panel
              eyebrow="Current persona"
              title="Planner-ready context"
              action={<Pill tone="warm">{bucketItems.length} owned spots</Pill>}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-[#eef3ff] px-3 py-3">
                  <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <Compass size={13} aria-hidden="true" />
                    Availability
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">
                    {currentCriteria.availableTimes.join(" / ")}
                  </p>
                </div>
                <div className="rounded-lg bg-[#eef2f0] px-3 py-3">
                  <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <SlidersHorizontal size={13} aria-hidden="true" />
                    Vetoes
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">{currentCriteria.vetoes.join(", ")}</p>
                </div>
                <div className="rounded-lg bg-[#f7efe2] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Pool strength</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">
                    {seededCriteria.length} friends aligned on one thread
                  </p>
                </div>
              </div>
            </Panel>

            <BucketPanel persona={currentPersona} items={bucketItems} />
            <CriteriaPanel criteria={seededCriteria} currentPersonaId={currentPersonaId} />
          </div>
        </div>
      </div>
    </main>
  );
}
