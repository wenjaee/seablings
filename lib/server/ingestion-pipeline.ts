import "server-only";

import { bucketCategoryValues, type CapturePayload } from "@/lib/domain";
import type { ManualBucketItemInput } from "@/lib/server/validation";
import {
  createGeminiEmbedding,
  enrichPlaceWithPerplexity,
  extractPlacesWithGemini,
  resolveProviderCapturePayload,
  type ProviderEmbedding,
  type ProviderPlaceEnrichment,
  type ProviderPlaceExtraction
} from "@/lib/server/providers";
import {
  normalizePlaceCategory,
  normalizePlaceTags,
  type PlaceCategory
} from "@/lib/server/place-categories";

type EnrichmentStatus = "complete" | "partial" | "fallback";

const RESERVED_TAGS = new Set([
  "ai",
  "ai-ingested",
  "capture",
  "fixture",
  "gemini",
  "instagram",
  "manual",
  "perplexity",
  "perplexity-enriched",
  "screenshot",
  "text",
  "tiktok",
  ...bucketCategoryValues
]);

export type IngestionBucketItemInput = Omit<ManualBucketItemInput, "tags"> & {
  tags: string[];
  enrichmentProvider?: string;
  enrichmentStatus?: EnrichmentStatus;
  enrichmentSourceLinks?: string[];
  enrichmentConfidenceNote?: string;
};

export type IngestionPipelinePlace = {
  category: PlaceCategory;
  bucketItem: IngestionBucketItemInput;
  embedding?: ProviderEmbedding;
};

export type IngestionPipelineResult = {
  places: IngestionPipelinePlace[];
  mode: "live" | "mixed" | "fallback";
  usedFallback: boolean;
};

export async function runIngestionPipeline(payload: CapturePayload): Promise<IngestionPipelineResult> {
  const providerPayload = await resolveProviderCapturePayload(payload);
  const extractedPlaces = await extractPlacesWithGemini(providerPayload);

  const places = await Promise.all(
    extractedPlaces.map(async (place) => {
      const enrichment = await enrichPlaceWithPerplexity(place, providerPayload);
      const category = normalizePlaceCategory(enrichment.categoryOverride ?? place.category);
      const bucketItem = mergeIntoBucketItem(place, enrichment, category, payload);
      const embeddingText = buildEmbeddingText(bucketItem);
      const embedding = await createGeminiEmbedding(embeddingText);

      return {
        category,
        bucketItem,
        embedding,
        extractionProvider: place.provider
      };
    })
  );

  const usedFallback = places.some(
    (place) => place.extractionProvider === "fixture" || place.bucketItem.enrichmentStatus === "fallback" || place.embedding?.skipped
  );
  const fullyFallback = places.every(
    (place) => place.extractionProvider === "fixture" && place.bucketItem.enrichmentStatus === "fallback" && place.embedding?.skipped
  );

  return {
    places: places.map(({ extractionProvider: _extractionProvider, ...place }) => place),
    mode: fullyFallback ? "fallback" : usedFallback ? "mixed" : "live",
    usedFallback
  };
}

function mergeIntoBucketItem(
  place: ProviderPlaceExtraction,
  enrichment: ProviderPlaceEnrichment,
  category: PlaceCategory,
  payload: CapturePayload
): IngestionBucketItemInput {
  const title = normalizeRequiredText(enrichment.canonicalName ?? place.title);
  const locationName = normalizeRequiredText(enrichment.locationName ?? place.locationName, title);
  const neighborhood = normalizeRequiredText(enrichment.neighborhood ?? place.neighborhood, "Unknown");
  const description = normalizeRequiredText(enrichment.description ?? place.description, `${title} found from ${payload.sourceType}.`);
  const whyInteresting = normalizeRequiredText(
    enrichment.whyInteresting ?? place.whyInteresting,
    `Saved from a ${payload.sourceType} capture for later review.`
  );
  const estimatedCost = normalizeEstimatedCost(enrichment.estimatedCost ?? place.estimatedCost);
  const priceEstimate = normalizePriceEstimate(enrichment.priceEstimate ?? place.priceEstimate, estimatedCost);
  const tags = normalizeUserFacingTags(
    enrichment.tags,
    buildTagSeed(category, neighborhood, title, description, whyInteresting)
  );

  return {
    userId: payload.userId,
    title,
    category,
    description,
    whyInteresting,
    locationName,
    neighborhood,
    priceEstimate,
    status: "candidate",
    dateType: "anytime",
    address: normalizeOptionalText(enrichment.address ?? place.address),
    postalCode: normalizeOptionalText(enrichment.postalCode ?? place.postalCode),
    estimatedCost,
    openingHours: normalizeOptionalText(enrichment.openingHours ?? place.openingHours),
    websiteUrl: normalizeOptionalText(enrichment.websiteUrl ?? place.websiteUrl),
    sourceUrl: payload.sourceUrl,
    sourceType: payload.sourceType,
    tags,
    confidence: normalizeConfidence(enrichment.confidence ?? place.confidence),
    startsAt: undefined,
    endsAt: undefined,
    enrichmentProvider: enrichment.provider,
    enrichmentStatus: enrichment.status,
    enrichmentSourceLinks: enrichment.sourceLinks.length > 0 ? enrichment.sourceLinks : undefined,
    enrichmentConfidenceNote:
      enrichment.status === "complete" ? undefined : normalizeOptionalText(enrichment.confidenceNote)
  };
}

function buildEmbeddingText(bucketItem: IngestionBucketItemInput): string {
  return [
    bucketItem.title,
    bucketItem.locationName,
    bucketItem.neighborhood,
    bucketItem.category,
    bucketItem.description,
    bucketItem.whyInteresting,
    bucketItem.address ? `Address: ${bucketItem.address}` : null,
    bucketItem.postalCode ? `Postal code: ${bucketItem.postalCode}` : null,
    `Price tier: ${bucketItem.priceEstimate}`,
    bucketItem.estimatedCost !== undefined ? `Estimated cost: ${bucketItem.estimatedCost}` : null,
    bucketItem.openingHours ? `Opening hours: ${bucketItem.openingHours}` : null,
    bucketItem.websiteUrl ? `Website: ${bucketItem.websiteUrl}` : null,
    bucketItem.tags.length > 0 ? `Tags: ${bucketItem.tags.join(", ")}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTagSeed(
  category: PlaceCategory,
  neighborhood: string,
  title: string,
  description: string,
  whyInteresting: string
): string[] {
  return [
    category,
    neighborhoodKeyword(neighborhood),
    ...extractDescriptiveKeywords(`${title}\n${description}\n${whyInteresting}`)
  ].filter((value): value is string => Boolean(value));
}

function normalizeUserFacingTags(tags: unknown, seed: string[] = []): string[] {
  const normalized = normalizePlaceTags(tags, seed).filter((tag) => !RESERVED_TAGS.has(tag));
  if (normalized.length >= 3) {
    return normalized.slice(0, 5);
  }

  const fallback = seed
    .map((value) => slugToken(value))
    .filter((value): value is string => Boolean(value))
    .filter((value) => !RESERVED_TAGS.has(value));

  return normalizePlaceTags(normalized, fallback)
    .filter((tag) => !RESERVED_TAGS.has(tag))
    .slice(0, 5);
}

function extractDescriptiveKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .filter((word) => !STOP_WORDS.has(word))
    .filter((word) => !RESERVED_TAGS.has(word));

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const word of words) {
    if (seen.has(word)) {
      continue;
    }

    seen.add(word);
    unique.push(word);

    if (unique.length === 4) {
      break;
    }
  }

  return unique;
}

function neighborhoodKeyword(value: string): string | null {
  if (!value || value === "Unknown") {
    return null;
  }

  return slugToken(value);
}

function slugToken(value: string): string | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length >= 2 ? normalized : null;
}

function normalizeRequiredText(value: string | undefined, fallback = "Untitled place"): string {
  const normalized = normalizeOptionalText(value);
  return normalized ?? fallback;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeEstimatedCost(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.round(value);
}

function normalizePriceEstimate(value: string | undefined, estimatedCost?: number): "$" | "$$" | "$$$" {
  if (typeof estimatedCost === "number" && Number.isFinite(estimatedCost) && estimatedCost >= 0) {
    if (estimatedCost <= 25) {
      return "$";
    }

    if (estimatedCost <= 75) {
      return "$$";
    }

    return "$$$";
  }

  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "$$";
  }

  if (normalized.includes("free")) {
    return "$";
  }

  if (normalized === "$$$" || normalized === "£££" || normalized.includes("luxury") || normalized.includes("expensive")) {
    return "$$$";
  }

  if (normalized === "$$" || normalized === "££" || normalized.includes("moderate")) {
    return "$$";
  }

  return "$";
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.65;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "around",
  "because",
  "capture",
  "found",
  "from",
  "later",
  "place",
  "saved",
  "seablings",
  "source",
  "this",
  "video",
  "worth"
]);
