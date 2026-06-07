"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { PersonaId } from "@/lib/domain";
import type { PlannerClient } from "@/lib/planner/contract";
import { HttpPlannerClient } from "@/lib/planner/http-client";
import { MockPlannerClient } from "@/lib/planner/mock-client";
import type { CriteriaResponse, PlannerSnapshot } from "@/lib/planner/types";

function createClient(): PlannerClient {
  if (process.env.NEXT_PUBLIC_PLANNER_BACKEND === "http") {
    return new HttpPlannerClient();
  }
  return new MockPlannerClient();
}

type PlannerContextValue = {
  snapshot: PlannerSnapshot | null;
  localUserId: PersonaId | null;
  active: boolean;
  start: (initiatorUserId: PersonaId) => Promise<void>;
  submitMyCriteria: (response: CriteriaResponse) => Promise<void>;
  castMyVote: (bucketItemIds: string[]) => Promise<void>;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ groupId, children }: { groupId: string; children: React.ReactNode }) {
  const clientRef = useRef<PlannerClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = createClient();
  }
  const client = clientRef.current;

  const [snapshot, setSnapshot] = useState<PlannerSnapshot | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const start = useCallback(
    async (initiatorUserId: PersonaId) => {
      const initial = await client.startSession({ groupId, initiatorUserId });
      unsubscribeRef.current?.();
      unsubscribeRef.current = client.subscribe(initial.session.id, setSnapshot);
      setSnapshot(initial);
    },
    [client, groupId]
  );

  const submitMyCriteria = useCallback(
    async (response: CriteriaResponse) => {
      if (!snapshot) {
        return;
      }
      await client.submitCriteria(snapshot.session.id, snapshot.session.initiatorUserId, response);
    },
    [client, snapshot]
  );

  const castMyVote = useCallback(
    async (bucketItemIds: string[]) => {
      if (!snapshot) {
        return;
      }
      await client.castVote(snapshot.session.id, snapshot.session.initiatorUserId, bucketItemIds);
    },
    [client, snapshot]
  );

  const value = useMemo<PlannerContextValue>(
    () => ({
      snapshot,
      localUserId: snapshot?.session.initiatorUserId ?? null,
      active: snapshot !== null,
      start,
      submitMyCriteria,
      castMyVote
    }),
    [snapshot, start, submitMyCriteria, castMyVote]
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const value = useContext(PlannerContext);
  if (!value) {
    throw new Error("usePlanner must be used within a PlannerProvider");
  }
  return value;
}
