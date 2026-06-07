import type { PersonaId } from "@/lib/domain";

export type CriteriaSubmitPayload = {
  availability: string;
  availabilityMode: "Whenever" | "Custom";
  budgetMode: "slider";
  budgetAmount: number;
  budgetMax: number;
  budgetOption: string;
  budgetText?: string;
  vetoText?: string;
  vetoes: string[];
};

export type PlannerMemberProgress = {
  userId: string;
  name: string;
  respondedCriteria?: boolean;
  voted?: boolean;
  isDone?: boolean;
  personaId?: PersonaId;
};

export type PlannerRecommendationCard = {
  bucketItemId: string;
  name?: string;
  title?: string;
  area?: string;
  address?: string;
  emoji?: string;
  budgetTier?: string;
  distanceKm?: number;
  distanceLabel?: string | null;
  mapsUrl?: string;
  photoUrl?: string;
  item?: {
    title?: string;
    neighborhood?: string | null;
    locationName?: string | null;
  };
};

export type PlannerWinner = PlannerRecommendationCard & {
  proposalDate?: string;
  proposalTime?: string;
  titleFallback?: string;
};

export type PlannerStatus = "collecting" | "voting" | "completed" | "canceled";
