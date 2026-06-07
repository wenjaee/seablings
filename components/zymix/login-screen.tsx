"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LockKeyhole } from "lucide-react";

import { Avatar } from "@/components/zymix/avatar";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { fetchCurrentPersona, normalizeNextPath } from "@/components/zymix/persona-session";
import { loginPersonas, normalizePersonaPayload, type ZymixPersonaId } from "@/lib/zymix/data";

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPersonaId, setSelectedPersonaId] = useState<ZymixPersonaId>("jeff");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = normalizeNextPath(searchParams.get("next"));

  useEffect(() => {
    let isActive = true;

    async function checkSession() {
      try {
        const persona = await fetchCurrentPersona();
        if (isActive && persona) {
          router.replace(nextPath as Route);
        }
      } catch {
        // Ignore login preflight errors and allow manual sign-in.
      }
    }

    void checkSession();

    return () => {
      isActive = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Read the PIN from the form, not just React state, so mobile keyboards / autofill
    // that set the value without firing onChange still work.
    const formData = new FormData(event.currentTarget);
    const pinValue = String(formData.get("pin") ?? "").trim() || pin.trim();
    if (!pinValue) {
      setError("Enter your PIN to continue.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          personaId: selectedPersonaId,
          pin: pinValue
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(response.status === 401 ? "Invalid PIN. Try again." : "Unable to sign in right now.");
        return;
      }

      const persona = normalizePersonaPayload(payload);
      if (!persona) {
        setError("Login succeeded but no persona was returned.");
        return;
      }

      router.replace(nextPath as Route);
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-4 pt-5 sm:px-5">
        <div className="rounded-[24px] bg-[var(--zx-surface)] px-4 py-4 shadow-[0_20px_48px_rgba(0,0,0,0.08)] sm:rounded-[28px] sm:px-5 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--zx-brand-soft)] text-[var(--zx-brand-deep)] sm:h-12 sm:w-12">
              <LockKeyhole size={19} />
            </span>
            <div>
              <h1 className="text-[24px] font-black tracking-tight text-[var(--zx-ink)]">ZYMIX</h1>
              <p className="text-[13px] text-[var(--zx-muted)]">Demo PIN login for SEAblings judges and teammates.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {loginPersonas.map((persona) => {
              const isActive = persona.id === selectedPersonaId;

              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => setSelectedPersonaId(persona.id)}
                  className={
                    isActive
                      ? "rounded-2xl border-2 border-[var(--zx-brand)] bg-white px-2.5 py-2.5 text-left shadow-[0_10px_20px_rgba(53,201,60,0.14)]"
                      : "rounded-2xl border-2 border-transparent bg-white px-2.5 py-2.5 text-left"
                  }
                >
                  <div className="flex items-center gap-3">
                    <Avatar spec={persona.avatar} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-[var(--zx-ink)]">{persona.name}</p>
                      <p className="truncate text-[12px] text-[var(--zx-muted)]">{persona.handle}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-5">
            <label className="block">
              <span className="text-[13px] font-semibold text-[var(--zx-ink)]">PIN</span>
              <div className="mt-2 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 sm:gap-3">
                <KeyRound size={18} className="text-[var(--zx-muted)]" />
                <input
                  name="pin"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter PIN"
                  aria-label="PIN"
                  className="min-w-0 flex-1 bg-transparent text-[16px] tracking-[0.3em] text-[var(--zx-ink)] outline-none placeholder:tracking-normal placeholder:text-[var(--zx-muted)] sm:text-[18px]"
                />
              </div>
            </label>

            {error ? (
              <p role="alert" className="mt-3 rounded-2xl bg-[#fff1ef] px-3.5 py-2.5 text-[13px] font-medium text-[#d94c3d] sm:px-4 sm:py-3 sm:text-[14px]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 w-full rounded-full bg-[var(--zx-brand)] px-4 py-2.5 text-[15px] font-bold text-white shadow-[0_16px_28px_rgba(53,201,60,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : `Continue as ${loginPersonas.find((persona) => persona.id === selectedPersonaId)?.name ?? "persona"}`}
            </button>
          </form>
        </div>
      </main>
    </PhoneShell>
  );
}
