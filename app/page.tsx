import Link from "next/link";
import { ArrowRight, ClipboardList, MessageCircle, Share2 } from "lucide-react";

const demoRoutes = [
  { href: "/demo/jeff", label: "Jeff", detail: "native share + saved spots" },
  { href: "/demo/praya", label: "Praya", detail: "seeded mobile persona" },
  { href: "/demo/tana", label: "Tana", detail: "seeded mobile persona" },
  { href: "/demo/control", label: "Control", detail: "judge-facing overview" }
] as const;

export default function Home() {
  return (
    <main className="min-h-dvh px-5 py-8 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col justify-between gap-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-sm text-[var(--muted)]">
              <Share2 size={15} aria-hidden="true" />
              VibeHack London demo build
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal text-[var(--ink)] sm:text-6xl">
              SEAblings
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-7 text-[var(--muted)]">
              Capture the places friends already share, turn them into saved spots, then let the group planner pick the strongest plan.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/demo/jeff"
                className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--accent-strong)]"
              >
                Open demo
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/api/captures"
                className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
              >
                Capture API
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
            <div className="grid gap-3">
              <div className="flex items-center gap-3 rounded-md bg-[#eef7f5] p-4">
                <Share2 className="text-[var(--accent)]" size={22} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Native share capture</p>
                  <p className="text-sm text-[var(--muted)]">TikTok, Instagram, and screenshots POST into `/api/captures`.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md bg-[#fff3e6] p-4">
                <ClipboardList className="text-[var(--coral)]" size={22} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Personal spots</p>
                  <p className="text-sm text-[var(--muted)]">Candidates become saved bucket-list items after review.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md bg-[#f5edff] p-4">
                <MessageCircle className="text-[#6f45b8]" size={22} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Zymix-style planner</p>
                  <p className="text-sm text-[var(--muted)]">`@planner` collects group criteria and returns top 3 cards.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Demo routes">
          {demoRoutes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--accent)]"
            >
              <span className="block text-sm font-semibold">{route.label}</span>
              <span className="mt-1 block text-sm text-[var(--muted)]">{route.detail}</span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
