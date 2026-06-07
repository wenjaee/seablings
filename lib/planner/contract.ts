import type { PersonaId } from "@/lib/domain";
import type { CriteriaResponse, PlannerSnapshot } from "@/lib/planner/types";

/**
 * THE CONTRACT.
 *
 * The frontend depends only on this interface and on `PlannerSnapshot`. A real
 * backend connects by providing a second implementation of `PlannerClient`
 * (see `http-client.ts`) — no UI changes required. Hand this file to whoever
 * builds the backend: it is the agreed shape.
 */
export interface PlannerClient {
  /** Triggered by `@planner` in chat. Opens the criteria dialog for the initiator. */
  startSession(input: { groupId: string; initiatorUserId: PersonaId }): Promise<PlannerSnapshot>;

  /** Read the current state of a session. */
  getSnapshot(sessionId: string): Promise<PlannerSnapshot>;

  /** Submit one member's criteria answers. */
  submitCriteria(sessionId: string, userId: PersonaId, response: CriteriaResponse): Promise<void>;

  /** Cast one member's vote (1–3 selected places). */
  castVote(sessionId: string, userId: PersonaId, bucketItemIds: string[]): Promise<void>;

  /**
   * Subscribe to snapshot updates. Returns an unsubscribe fn.
   * Mock uses an in-memory emitter; a real client uses polling or Supabase realtime.
   */
  subscribe(sessionId: string, callback: (snapshot: PlannerSnapshot) => void): () => void;
}

export type CriteriaQuestion = {
  id: "availability" | "budget" | "vetoes";
  /** Whether the user may pick multiple preset options (vetoes) or one. */
  multiSelect: boolean;
  prompt: string;
  options: string[];
  /** Placeholder for the free-text "Type your answer…" option (D). */
  freeTextPlaceholder: string;
};

/** PRD §5.2 — the 3 criteria questions, presented in sequence. */
export const CRITERIA_QUESTIONS: CriteriaQuestion[] = [
  {
    id: "availability",
    multiSelect: false,
    prompt: "When are you available?",
    options: ["Anytime this weekend", "After office hours", "Whenever"],
    freeTextPlaceholder: "Type your answer..."
  },
  {
    id: "budget",
    multiSelect: false,
    prompt: "What's your budget?",
    options: ["Under £10", "£10–20", "£20+"],
    freeTextPlaceholder: "Type your answer..."
  },
  {
    id: "vetoes",
    multiSelect: true,
    prompt: "Anything to avoid?",
    options: ["No seafood", "Halal only", "No alcohol"],
    freeTextPlaceholder: "Type your answer..."
  }
];
