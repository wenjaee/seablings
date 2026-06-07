export type PersonaId = "jeff" | "praya" | "tana" | "tester";

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
