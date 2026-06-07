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

export type CriteriaQuestion =
  | {
      id: "availability";
      kind: "choice";
      prompt: string;
      /** Preset options shown as tappable buttons; a free-text row follows. */
      options: string[];
      freeTextPlaceholder: string;
    }
  | {
      id: "budget";
      kind: "slider";
      prompt: string;
      min: number;
      max: number;
      step: number;
      /** Currency/label prefix, e.g. "£". The max value is shown as "{unit}{max}+". */
      unit: string;
    }
  | {
      id: "vetoes";
      kind: "freetext";
      prompt: string;
      freeTextPlaceholder: string;
    };

/** PRD §5.2 — the 3 criteria questions, presented in sequence. */
export const CRITERIA_QUESTIONS: CriteriaQuestion[] = [
  {
    id: "availability",
    kind: "choice",
    prompt: "When are you available?",
    options: ["Whenever"],
    freeTextPlaceholder: "Type your answer..."
  },
  {
    id: "budget",
    kind: "slider",
    prompt: "What's your budget?",
    min: 0,
    max: 40,
    step: 5,
    unit: "£"
  },
  {
    id: "vetoes",
    kind: "freetext",
    prompt: "Anything to avoid?",
    freeTextPlaceholder: "Type your answer..."
  }
];
