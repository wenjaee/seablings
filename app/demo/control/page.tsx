import Link from "next/link";
import { ArrowLeft, Bot, ListFilter, Users } from "lucide-react";

import { CaptureQueuePanel, PersonaLinksPanel, PooledSpotsPanel } from "@/components/demo/control-panels";
import { CriteriaPanel, RecommendationPanel } from "@/components/demo/planner-panels";
import { PersonaTabs, Pill } from "@/components/demo/primitives";
import { demoCaptureTasks, demoPersonas, getRecommendations, pooledBucketItems } from "@/lib/demo/data";
import { seededCriteria } from "@/lib/fixtures";

export default function ControlDemoPage() {
  const recommendations = getRecommendations();
  const candidateCount = pooledBucketItems.filter((item) => item.status === "candidate").length;

  return (
    <main className="min-h-dvh bg-[#eef4f2] px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl">
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
              <PersonaTabs personas={demoPersonas} currentPath="/demo/control" />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Pill tone="accent">Judge overview</Pill>
                  <Pill tone="warm">Fixture fallback active</Pill>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">SEAblings control room</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Full mobile-web loop from capture queue to planner picks, without waiting on backend completion.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 lg:min-w-[420px]">
                <div className="rounded-lg bg-[#e5f4f1] px-3 py-3">
                  <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <Users size={13} aria-hidden="true" />
                    Personas
                  </p>
                  <p className="mt-1 text-base font-semibold text-[var(--ink)]">{demoPersonas.length}</p>
                </div>
                <div className="rounded-lg bg-[#fff0df] px-3 py-3">
                  <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <ListFilter size={13} aria-hidden="true" />
                    Pool
                  </p>
                  <p className="mt-1 text-base font-semibold text-[var(--ink)]">{pooledBucketItems.length} spots</p>
                </div>
                <div className="rounded-lg bg-[#eef3ff] px-3 py-3">
                  <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <Bot size={13} aria-hidden="true" />
                    Live candidate
                  </p>
                  <p className="mt-1 text-base font-semibold text-[var(--ink)]">{candidateCount}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <div className="space-y-4">
            <CaptureQueuePanel tasks={demoCaptureTasks} />
            <PersonaLinksPanel />
          </div>

          <div className="space-y-4">
            <PooledSpotsPanel items={pooledBucketItems} />
            <CriteriaPanel criteria={seededCriteria} />
            <RecommendationPanel recommendations={recommendations} />
          </div>
        </div>
      </div>
    </main>
  );
}
