"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getZymixPersona, normalizePersonaPayload, type ZymixPersona } from "@/lib/zymix/data";

function buildCurrentPath(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getLoginHref(nextPath: string) {
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";
  return `/login?next=${encodeURIComponent(safeNext)}`;
}

export function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/";
  }

  return value;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchCurrentPersona() {
  const response = await fetch("/api/auth/me", {
    cache: "no-store",
    credentials: "include"
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load your Zymix session.");
  }

  return normalizePersonaPayload(await readJson(response));
}

export function useCurrentPersona({ redirectToLogin = false }: { redirectToLogin?: boolean } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [persona, setPersona] = useState<ZymixPersona | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadPersona() {
      setIsLoading(true);
      setError(null);

      try {
        const nextPersona = await fetchCurrentPersona();
        if (!isActive) {
          return;
        }

        setPersona(nextPersona);

        if (!nextPersona && redirectToLogin) {
          router.replace(getLoginHref(buildCurrentPath(pathname, searchParams)) as Route);
        }
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load your Zymix session.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadPersona();

    return () => {
      isActive = false;
    };
  }, [pathname, redirectToLogin, router, searchParams]);

  return {
    persona,
    isLoading,
    error,
    setPersona
  };
}

export function resolvePersonaId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return getZymixPersona(value)?.id ?? null;
}
