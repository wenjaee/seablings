import type { BucketItem, PersonaId } from "@/lib/domain";
import { personas, seededBucketItems, seededRecommendations } from "@/lib/fixtures";
import type { PlannerClient } from "@/lib/planner/contract";
import type {
  BudgetTier,
  CriteriaResponse,
  MemberProgress,
  PlannerSnapshot,
  RecommendationCard
} from "@/lib/planner/types";

/**
 * In-browser stand-in for the planner backend. Holds session state in memory
 * and auto-simulates the other group members (Jeff & Praya) responding and
 * voting on timers, so the full flow self-advances for the demo.
 *
 * Swap this out by providing another `PlannerClient` (see http-client.ts) —
 * no UI changes needed.
 */

/** Pace of the simulated members. Tune for demo feel. */
const STEP_MS = 1800;

const CATEGORY_EMOJI: Record<BucketItem["category"], string> = {
  eats: "🍽️",
  drinks: "🍸",
  cafe: "☕",
  nightlife: "🪩",
  activity: "🎾",
  culture: "🖼️",
  hidden_gem: "✨",
  market: "🥖",
  other: "📍"
};

type Listener = (snapshot: PlannerSnapshot) => void;

export class MockPlannerClient implements PlannerClient {
  private localUserId: PersonaId = "tana";
  private groupId = "seablings";
  private status: PlannerSnapshot["session"]["status"] = "collecting";
  private createdAt = new Date().toISOString();
  private updatedAt = this.createdAt;
  private sessionId = `session-${Date.now()}`;

  private responded = new Set<PersonaId>();
  private voted = new Set<PersonaId>();
  private votes = new Map<PersonaId, string[]>();

  private recommendations: RecommendationCard[] = [];
  private winners: RecommendationCard[] = [];
  private proposedTime?: string;
  private proposedStartIso?: string;

  private listeners = new Set<Listener>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  async startSession(input: { groupId: string; initiatorUserId: PersonaId }): Promise<PlannerSnapshot> {
    this.reset();
    this.groupId = input.groupId;
    this.localUserId = input.initiatorUserId;
    return this.buildSnapshot();
  }

  async getSnapshot(): Promise<PlannerSnapshot> {
    return this.buildSnapshot();
  }

  async submitCriteria(_sessionId: string, userId: PersonaId, _response: CriteriaResponse): Promise<void> {
    this.responded.add(userId);
    this.touch();
    this.emit();

    if (userId === this.localUserId) {
      this.simulateOthersCriteria();
    }
  }

  async castVote(_sessionId: string, userId: PersonaId, bucketItemIds: string[]): Promise<void> {
    this.votes.set(userId, bucketItemIds);
    this.voted.add(userId);
    this.touch();
    this.emit();

    if (userId === this.localUserId) {
      this.simulateOthersVotes();
    }
  }

  subscribe(_sessionId: string, callback: Listener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // --- simulation -----------------------------------------------------------

  private simulateOthersCriteria(): void {
    const others = this.otherMemberIds();
    others.forEach((userId, index) => {
      this.schedule(STEP_MS * (index + 1), () => {
        this.responded.add(userId);
        this.touch();
        this.emit();
      });
    });

    // Once everyone has responded, aggregate and open voting.
    this.schedule(STEP_MS * (others.length + 1), () => {
      this.status = "voting";
      this.recommendations = buildRecommendationCards();
      const proposed = nextSaturdayNoon();
      this.proposedStartIso = proposed.toISOString();
      this.proposedTime = "Saturday 12:00";
      this.touch();
      this.emit();
    });
  }

  private simulateOthersVotes(): void {
    const others = this.otherMemberIds();
    const topPick = this.recommendations[0]?.bucketItemId;

    others.forEach((userId, index) => {
      this.schedule(STEP_MS * (index + 1), () => {
        // Simulated members rally behind the top recommendation.
        this.votes.set(userId, topPick ? [topPick] : []);
        this.voted.add(userId);
        this.touch();
        this.emit();
      });
    });

    this.schedule(STEP_MS * (others.length + 1), () => {
      this.status = "completed";
      this.winners = this.tallyWinners();
      this.touch();
      this.emit();
    });
  }

  private tallyWinners(): RecommendationCard[] {
    const counts = new Map<string, number>();
    for (const ids of this.votes.values()) {
      for (const id of ids) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }

    let max = 0;
    for (const count of counts.values()) {
      max = Math.max(max, count);
    }
    if (max === 0) {
      return this.recommendations.slice(0, 1);
    }

    const winningIds = new Set([...counts.entries()].filter(([, count]) => count === max).map(([id]) => id));
    return this.recommendations.filter((card) => winningIds.has(card.bucketItemId));
  }

  // --- helpers --------------------------------------------------------------

  private otherMemberIds(): PersonaId[] {
    return personas.map((persona) => persona.id).filter((id) => id !== this.localUserId);
  }

  private buildSnapshot(): PlannerSnapshot {
    const members: MemberProgress[] = personas.map((persona) => ({
      userId: persona.id,
      name: persona.name,
      respondedCriteria: this.responded.has(persona.id),
      voted: this.voted.has(persona.id)
    }));

    return {
      session: {
        id: this.sessionId,
        groupId: this.groupId,
        initiatorUserId: this.localUserId,
        status: this.status,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      },
      members,
      proposedTime: this.proposedTime,
      proposedStartIso: this.proposedStartIso,
      recommendations: this.recommendations,
      winners: this.winners,
      myCriteriaSubmitted: this.responded.has(this.localUserId),
      myVoteSubmitted: this.voted.has(this.localUserId)
    };
  }

  private emit(): void {
    const snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private touch(): void {
    this.updatedAt = new Date().toISOString();
  }

  private schedule(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private reset(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.status = "collecting";
    this.responded.clear();
    this.voted.clear();
    this.votes.clear();
    this.recommendations = [];
    this.winners = [];
    this.proposedTime = undefined;
    this.proposedStartIso = undefined;
    this.sessionId = `session-${Date.now()}`;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
  }
}

// --- enrichment (faked here; backend/Perplexity provides this in production) --

function buildRecommendationCards(): RecommendationCard[] {
  const byId = new Map(seededBucketItems.map((item) => [item.id, item]));

  return seededRecommendations
    .map((rec, index) => {
      const item = byId.get(rec.bucketItemId);
      if (!item) {
        return null;
      }
      return cardFromItem(item, index);
    })
    .filter((card): card is RecommendationCard => card !== null)
    .slice(0, 3);
}

function cardFromItem(item: BucketItem, index: number): RecommendationCard {
  const query = encodeURIComponent(`${item.locationName} ${item.postalCode ?? item.neighborhood}`);
  return {
    bucketItemId: item.id,
    name: item.title,
    area: item.neighborhood,
    address: item.address ?? `${item.neighborhood}, London ${item.postalCode ?? ""}`.trim(),
    emoji: CATEGORY_EMOJI[item.category],
    budgetTier: budgetTierFromPrice(item.priceEstimate),
    // Stable, deterministic faux distance until real postcode math lands.
    distanceKm: Number((1.2 + index * 0.9).toFixed(1)),
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${query}`
  };
}

function budgetTierFromPrice(price: string): BudgetTier {
  const pounds = (price.match(/£/g) ?? []).length;
  if (pounds >= 3) {
    return "$$$";
  }
  if (pounds === 2) {
    return "$$";
  }
  return "$";
}

function nextSaturdayNoon(): Date {
  const date = new Date();
  const day = date.getDay(); // 0 = Sun … 6 = Sat
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  date.setHours(12, 0, 0, 0);
  return date;
}
