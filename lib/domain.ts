export type PersonaId = "jeff" | "praya" | "tana" | "tester";

export type PlannerParticipantId = Extract<PersonaId, "jeff" | "praya" | "tana">;

export type SourcePlatform = "tiktok" | "instagram" | "screenshot" | "manual" | "text";

export type BucketItemStatus = "candidate" | "saved" | "completed" | "rejected" | "archived";

export type BucketItemDateType = "anytime" | "one_off" | "limited_run" | "scheduled";

export const bucketCategoryValues = [
  "bakery",
  "cafe",
  "restaurant",
  "bar",
  "nightlife",
  "activity",
  "culture",
  "shopping",
  "other"
] as const;

export type BucketCategory = (typeof bucketCategoryValues)[number];

export const priceEstimateTierValues = ["$", "$$", "$$$"] as const;

export type PriceEstimateTier = (typeof priceEstimateTierValues)[number];

export const bucketItemEnrichmentStatusValues = ["complete", "partial", "fallback"] as const;

export type BucketItemEnrichmentStatus = (typeof bucketItemEnrichmentStatusValues)[number];

export type IngestionTaskStatus =
  | "queued"
  | "processing"
  | "extracting"
  | "enriching"
  | "embedding"
  | "completed"
  | "failed";

export type Persona = {
  id: PersonaId;
  name: "Jeff" | "Praya" | "Tana" | "Tester";
  color: string;
  postalCode: string;
  defaultBudgetMax: number;
};

export type CapturePayload = {
  userId: PersonaId;
  sourceType: SourcePlatform;
  sourceUrl?: string;
  text?: string;
  screenshotName?: string;
  screenshotBase64?: string;
};

export type IngestionTask = {
  id: string;
  userId: PersonaId;
  status: IngestionTaskStatus;
  sourceType: SourcePlatform;
  sourceUrl?: string;
  text?: string;
  screenshotName?: string;
  createdAt: string;
  updatedAt: string;
};

export type BucketItem = {
  id: string;
  userId: PersonaId;
  status: BucketItemStatus;
  dateType: BucketItemDateType;
  title: string;
  category: BucketCategory;
  description: string;
  whyInteresting: string;
  locationName: string;
  neighborhood: string;
  address?: string;
  postalCode?: string;
  priceEstimate: PriceEstimateTier;
  estimatedCost: number;
  openingHours?: string;
  websiteUrl?: string;
  sourceUrl?: string;
  sourceType: SourcePlatform;
  enrichmentProvider?: string;
  enrichmentStatus?: BucketItemEnrichmentStatus;
  enrichmentSourceLinks?: string[];
  enrichmentConfidenceNote?: string;
  tags: string[];
  confidence: number;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanningCriteria = {
  userId: PersonaId;
  budgetMax: number;
  availableTimes: string[];
  postalCode: string;
  vetoes: string[];
};

export type Recommendation = {
  bucketItemId: string;
  score: number;
  reasons: string[];
  warnings: string[];
};

export type PlannerSessionStatus = "collecting" | "voting" | "completed" | "canceled";

export type PlannerCriteriaAnswer = {
  userId: PlannerParticipantId;
  availabilityMode: "Whenever" | "Custom";
  availability: string;
  budgetMode: "slider" | "text";
  budgetAmount: number;
  budgetOption?: string;
  budgetText?: string;
  budgetMin: number;
  budgetMax: number;
  areaHints: string[];
  vibeHints: string[];
  vetoes: string[];
  vetoText?: string;
  submittedAt: string;
};

export type PlannerAggregateCriteria = {
  version: 1;
  budgetMin: number;
  budgetMax: number;
  availabilitySummary: string;
  proposedTime: string;
  areaHints: string[];
  vibeHints: string[];
  vetoes: string[];
  strictVetoes: string[];
  source?: "heuristic" | "gemini";
  confidence?: number;
};

export type PlannerRecommendation = {
  owner: {
    id: PersonaId;
    name: string;
  };
  bucketItemId: string;
  item: BucketItem;
  score: number;
  reasons: string[];
  warnings: string[];
  distanceLabel?: string | null;
  mapsUrl?: string | null;
};

export type PlannerVote = {
  userId: PlannerParticipantId;
  bucketItemIds: string[];
  submittedAt: string;
};

export type PlannerFinalPlan = {
  bucketItemId: string;
  recommendation: PlannerRecommendation;
  winningItems: BucketItem[];
  proposedTime: string;
  calendarUrl: string;
  winnerIds: string[];
  tiedWinnerIds: string[];
  voteCounts: Record<string, number>;
};

export type PlannerSession = {
  id: string;
  threadId: string;
  initiatorUserId: PersonaId;
  status: PlannerSessionStatus;
  canceledAt?: string;
  canceledByUserId?: PlannerParticipantId;
  participants: PlannerParticipantId[];
  criteriaByUserId: Partial<Record<PlannerParticipantId, PlannerCriteriaAnswer>>;
  aggregateCriteria?: PlannerAggregateCriteria;
  votesByUserId: Partial<Record<PlannerParticipantId, PlannerVote>>;
  recommendations: PlannerRecommendation[];
  proposedTime?: string;
  finalPlan?: PlannerFinalPlan;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  userId: PersonaId | "planner";
  text: string;
  createdAt: string;
};

export type ZymixMessage = {
  id: string;
  threadId: string;
  userId: PersonaId;
  text: string;
  createdAt: string;
};
