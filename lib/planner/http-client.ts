import type { PersonaId } from "@/lib/domain";
import type { PlannerClient } from "@/lib/planner/contract";
import type { CriteriaResponse, PlannerSnapshot } from "@/lib/planner/types";

/**
 * Skeleton for the real backend. Fill these in once the teammate exposes
 * `/api/planner/*` endpoints that return `PlannerSnapshot`-shaped JSON, then
 * activate by setting `NEXT_PUBLIC_PLANNER_BACKEND=http` (see PlannerProvider).
 *
 * The UI already type-checks against this — no component changes will be needed.
 */
export class HttpPlannerClient implements PlannerClient {
  constructor(private readonly baseUrl = "/api/planner") {}

  async startSession(input: { groupId: string; initiatorUserId: PersonaId }): Promise<PlannerSnapshot> {
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!res.ok) {
      throw new Error(`startSession failed: ${res.status}`);
    }
    return (await res.json()) as PlannerSnapshot;
  }

  async getSnapshot(sessionId: string): Promise<PlannerSnapshot> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
    if (!res.ok) {
      throw new Error(`getSnapshot failed: ${res.status}`);
    }
    return (await res.json()) as PlannerSnapshot;
  }

  async submitCriteria(sessionId: string, userId: PersonaId, response: CriteriaResponse): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/criteria`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, response })
    });
    if (!res.ok) {
      throw new Error(`submitCriteria failed: ${res.status}`);
    }
  }

  async castVote(sessionId: string, userId: PersonaId, bucketItemIds: string[]): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/votes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, bucketItemIds })
    });
    if (!res.ok) {
      throw new Error(`castVote failed: ${res.status}`);
    }
  }

  /**
   * Polling-based realtime seam. Swap for a Supabase realtime channel if the
   * backend uses Supabase. The UI only consumes whole snapshots either way.
   */
  subscribe(sessionId: string, callback: (snapshot: PlannerSnapshot) => void): () => void {
    let active = true;
    const interval = setInterval(async () => {
      if (!active) {
        return;
      }
      try {
        callback(await this.getSnapshot(sessionId));
      } catch {
        // swallow transient poll errors
      }
    }, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }
}
