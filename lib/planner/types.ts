import type { PersonaId } from "@/lib/domain";

/**
 * View + state types for the `@planner` Agent flow.
 *
 * These are the only types the UI reads. Whatever backend ends up behind the
 * `PlannerClient` contract (mock now, REST/Supabase later) must populate a
 * `PlannerSnapshot` of this exact shape — that is the integration agreement.
 */

export type PlannerStatus = "collecting" | "voting" | "completed";

export type BudgetTier = "$" | "$$" | "$$$";

/** PRD §8 PlanningSession */
export type PlanningSession = {
  id: string;
  groupId: string;
  initiatorUserId: PersonaId;
  status: PlannerStatus;
  createdAt: string;
  updatedAt: string;
};

/** PRD §8 Vote */
export type Vote = {
  sessionId: string;
  userId: PersonaId;
  bucketItemIds: string[];
  submittedAt: string;
};

/**
 * What the Criteria Collection Dialog collects from a single user.
 * The client implementation maps this onto the persisted criteria shape
 * (`domain.PlanningCriteria`) — the UI never needs to know how.
 */
export type CriteriaResponse = {
  availability: string;
  budget: string;
  vetoes: string[];
};

/**
 * Enriched recommendation card — the exact view model a card renders.
 * Fields like `photoUrl`/`area`/`distanceKm` come from backend enrichment
 * (Perplexity, postcode math) in production, and are faked by the mock now.
 */
export type RecommendationCard = {
  bucketItemId: string;
  name: string;
  area: string;
  address?: string;
  emoji: string;
  photoUrl?: string;
  budgetTier: BudgetTier;
  distanceKm: number;
  mapsUrl: string;
};

export type MemberProgress = {
  userId: PersonaId;
  name: string;
  respondedCriteria: boolean;
  voted: boolean;
};

/**
 * The single object the UI reacts to. Every client method resolves/streams
 * one of these. Add fields here (not new endpoints) when the UI needs more.
 */
export type PlannerSnapshot = {
  session: PlanningSession;
  members: MemberProgress[];
  /** Human label, e.g. "Saturday 12:00". */
  proposedTime?: string;
  /** ISO start used to build the calendar deep link. */
  proposedStartIso?: string;
  recommendations: RecommendationCard[];
  winners: RecommendationCard[];
  /** Whether *the local user* has completed each step (drives which overlay shows). */
  myCriteriaSubmitted: boolean;
  myVoteSubmitted: boolean;
};
