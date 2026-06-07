import "server-only";

import { createHash } from "node:crypto";

import {
  bucketCategoryValues,
  type CapturePayload,
  type PlannerAggregateCriteria,
  type PlannerCriteriaAnswer
} from "@/lib/domain";
import {
  inferPlaceCategory,
  normalizeConfidence,
  normalizePlaceCategory,
  normalizePlaceTags,
  type PlaceCategory
} from "@/lib/server/place-categories";
import { ValidationError } from "@/lib/server/validation";

const GEMINI_EXTRACTION_MODEL = "gemini-2.5-flash";
const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const PERPLEXITY_MODEL = "sonar-pro";
const EMBEDDING_DIMENSIONS = 768;
const REQUEST_TIMEOUT_MS = 20_000;
const VIDEO_EXTRACTION_TIMEOUT_MS = 60_000;
const VIDEO_DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_INLINE_VIDEO_BYTES = 18 * 1024 * 1024;
const PLANNER_AGGREGATE_BUDGET_CAP = 60;
const ENRICHMENT_CORE_FIELDS = ["address", "postalCode", "priceEstimate", "openingHours", "websiteUrl"] as const;
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
  "social",
  "text",
  "tiktok",
  ...bucketCategoryValues
]);
const STOP_WORDS = new Set([
  "about",
  "after",
  "around",
  "because",
  "capture",
  "enough",
  "found",
  "from",
  "later",
  "looks",
  "person",
  "place",
  "ready",
  "revisit",
  "saved",
  "seablings",
  "seems",
  "short",
  "social",
  "source",
  "their",
  "there",
  "these",
  "this",
  "video",
  "worth"
]);

type PriceTier = "$" | "$$" | "$$$";
type EnrichmentStatus = "complete" | "partial" | "fallback";

export type ProviderPlaceExtraction = {
  title: string;
  description: string;
  whyInteresting: string;
  locationName: string;
  neighborhood: string;
  address?: string;
  postalCode?: string;
  priceEstimate: PriceTier;
  estimatedCost?: number;
  openingHours?: string;
  websiteUrl?: string;
  tags: string[];
  category: PlaceCategory;
  confidence: number;
  provider: "gemini" | "fixture";
};

export type ProviderPlaceEnrichment = {
  canonicalName?: string;
  description?: string;
  whyInteresting?: string;
  locationName?: string;
  neighborhood?: string;
  address?: string;
  postalCode?: string;
  priceEstimate?: PriceTier;
  estimatedCost?: number;
  openingHours?: string;
  websiteUrl?: string;
  photoUrl?: string;
  photoSourceLinks?: string[];
  sourceLinks: string[];
  confidenceNote?: string;
  dateHints?: string[];
  tags: string[];
  categoryOverride?: PlaceCategory;
  confidence?: number;
  status: EnrichmentStatus;
  provider: "perplexity" | "fixture";
};

export type ProviderEmbedding = {
  values: number[];
  text: string;
  model: string;
  dimensions: number;
  contentHash: string;
  skipped?: boolean;
};

type PlannerAggregateCriteriaResponse = {
  budgetMin?: unknown;
  budgetMax?: unknown;
  availabilitySummary?: unknown;
  proposedTime?: unknown;
  areaHints?: unknown;
  vibeHints?: unknown;
  vetoes?: unknown;
  strictVetoes?: unknown;
  source?: unknown;
  confidence?: unknown;
};

type GeminiExtractionResponse = {
  places?: Array<Record<string, unknown>>;
};

type PerplexityEnrichmentResponse = {
  canonicalName?: unknown;
  description?: unknown;
  whyInteresting?: unknown;
  locationName?: unknown;
  neighborhood?: unknown;
  address?: unknown;
  postalCode?: unknown;
  priceEstimate?: unknown;
  estimatedCost?: unknown;
  openingHours?: unknown;
  websiteUrl?: unknown;
  sourceLinks?: unknown;
  confidenceNote?: unknown;
  dateHints?: unknown;
  tags?: unknown;
  categoryOverride?: unknown;
  confidence?: unknown;
};

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: unknown;
  };
};

type GeminiPart =
  | {
      text: string;
    }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };

type SanitizedPerplexityAttempt = {
  canonicalName?: string;
  description?: string;
  whyInteresting?: string;
  locationName?: string;
  neighborhood?: string;
  address?: string;
  postalCode?: string;
  priceEstimate?: PriceTier;
  estimatedCost?: number;
  openingHours?: string;
  websiteUrl?: string;
  photoUrl?: string;
  photoSourceLinks?: string[];
  sourceLinks: string[];
  confidenceNote?: string;
  dateHints?: string[];
  tags: string[];
  categoryOverride?: PlaceCategory;
  confidence?: number;
};

type SocialContentType = "video" | "carousel" | "image";

export type SocialCaptureMetadata = {
  platform: "tiktok" | "instagram";
  contentType: SocialContentType;
  caption?: string;
  authorHandle?: string;
  authorDisplayName?: string;
  thumbnail?: string;
  imageUrls?: string[];
  videoUrl?: string;
  sourceUrl: string;
};

export type ProviderCapturePayload = CapturePayload & {
  resolvedSourceMetadata?: SocialCaptureMetadata;
};

type TikTokResponse = {
  data?: unknown;
};

type InstagramGraphQLResponse = {
  data?: unknown;
};

type PerplexityImage = {
  image_url?: unknown;
  origin_url?: unknown;
  title?: unknown;
  width?: unknown;
  height?: unknown;
};

type PerplexityImageResult = {
  photoUrl?: string;
  photoSourceLinks?: string[];
};

const ENSEMBLE_BASE_URL = "https://ensembledata.com/apis";

export async function resolveProviderCapturePayload(payload: CapturePayload): Promise<ProviderCapturePayload> {
  if (!isSocialCaptureWithUrl(payload)) {
    return payload;
  }

  const token = process.env.ENSEMBLEDATA_TOKEN?.trim();
  if (!token) {
    if (isUrlOnlySocialCapture(payload)) {
      throw new ValidationError(
        `${titleCase(payload.sourceType)} URL captures require ENSEMBLEDATA_TOKEN or additional text context. Extraction was not attempted from the bare URL.`
      );
    }

    return payload;
  }

  try {
    const resolvedSourceMetadata =
      payload.sourceType === "tiktok"
        ? await fetchTikTokSourceMetadata(payload.sourceUrl, token)
        : await fetchInstagramSourceMetadata(payload.sourceUrl, token);

    return {
      ...payload,
      resolvedSourceMetadata
    };
  } catch (error) {
    if (isUrlOnlySocialCapture(payload)) {
      throw new ValidationError(
        `Failed to fetch ${titleCase(payload.sourceType)} caption/media metadata from EnsembleData. Extraction was not attempted from the bare URL.`
      );
    }

    return payload;
  }
}

export async function extractPlacesWithGemini(payload: ProviderCapturePayload): Promise<ProviderPlaceExtraction[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildFallbackExtractions(payload);
  }

  const videoUrl = payload.resolvedSourceMetadata?.videoUrl?.trim();
  if (videoUrl) {
    const videoPrompt = buildGeminiVideoExtractionPrompt(payload);
    console.info("[Gemini Extraction] Downloading video for inline media extraction.");
    const inlineVideoPart = await buildInlineVideoPart(videoUrl).catch(() => null);
    if (inlineVideoPart) {
      const inlineExtractions = await requestGeminiExtractions(apiKey, payload, [
        inlineVideoPart,
        {
          text: videoPrompt
        }
      ]).catch(() => null);

      if (inlineExtractions?.length) {
        console.info(`[Gemini Extraction] Inline video extraction returned ${inlineExtractions.length} place(s).`);
        return inlineExtractions;
      }
    }

    console.info("[Gemini Extraction] Inline video extraction unavailable; falling back to caption/text extraction.");
  }

  const textExtractions = await requestGeminiExtractions(apiKey, payload, [
    {
      text: buildGeminiExtractionPrompt(payload)
    }
  ]).catch(() => null);

  return textExtractions?.length ? textExtractions : buildFallbackExtractions(payload);
}

export async function enrichPlaceWithPerplexity(
  place: ProviderPlaceExtraction,
  payload: ProviderCapturePayload
): Promise<ProviderPlaceEnrichment> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    return buildFallbackEnrichment(place, payload, "Perplexity API key missing. Preserved extraction-only fields.");
  }

  try {
    const initialAttempt = await requestPerplexityEnrichment(apiKey, buildPerplexityEnrichmentPrompt(place, payload));
    if (!initialAttempt) {
      return buildFallbackEnrichment(
        place,
        payload,
        "Perplexity returned no parseable enrichment. Preserved extraction-only fields."
      );
    }

    let finalAttempt = initialAttempt;
    if (shouldRetryPerplexityEnrichment(initialAttempt, place)) {
      const retryAttempt = await requestPerplexityEnrichment(
        apiKey,
        buildPerplexityExactMatchRetryPrompt(place, payload, initialAttempt)
      ).catch(() => null);

      if (retryAttempt) {
        finalAttempt = mergePerplexityAttempts(initialAttempt, retryAttempt);
      }
    }

    return finalizePerplexityEnrichment(finalAttempt, place);
  } catch {
    return buildFallbackEnrichment(place, payload, "Perplexity request failed. Preserved extraction-only fields.");
  }
}

export async function enrichPlacePhotoWithPerplexity(
  place: Pick<ProviderPlaceExtraction, "title" | "locationName" | "neighborhood" | "address" | "websiteUrl">
): Promise<PerplexityImageResult | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  try {
    const response = await requestPerplexityImages(apiKey, buildPerplexityPhotoPrompt(place));
    return extractPerplexityImageResult(response);
  } catch {
    return null;
  }
}

export async function createGeminiEmbedding(text: string): Promise<ProviderEmbedding> {
  const normalizedText = text.trim();
  const contentHash = createContentHash(normalizedText);

  if (!normalizedText) {
    return {
      values: [],
      text: normalizedText,
      model: GEMINI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      contentHash,
      skipped: true
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      values: [],
      text: normalizedText,
      model: GEMINI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      contentHash,
      skipped: true
    };
  }

  try {
    const response = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          taskType: "SEMANTIC_SIMILARITY",
          content: {
            parts: [
              {
                text: normalizedText
              }
            ]
          },
          output_dimensionality: EMBEDDING_DIMENSIONS
        })
      }
    );

    const values = normalizeEmbeddingValues((response as GeminiEmbeddingResponse).embedding?.values);
    if (values.length !== EMBEDDING_DIMENSIONS) {
      return {
        values: [],
        text: normalizedText,
        model: GEMINI_EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        contentHash,
        skipped: true
      };
    }

    return {
      values,
      text: normalizedText,
      model: GEMINI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      contentHash
    };
  } catch {
    return {
      values: [],
      text: normalizedText,
      model: GEMINI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      contentHash,
      skipped: true
    };
  }
}

export async function buildPlannerAggregateCriteria(
  criteria: PlannerCriteriaAnswer[]
): Promise<PlannerAggregateCriteria> {
  const fallback = buildFallbackPlannerAggregateCriteria(criteria);
  if (criteria.length === 0) {
    return fallback;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return fallback;
  }

  const prompt = buildPlannerAggregateCriteriaPrompt(criteria);
  try {
    const response = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EXTRACTION_MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: PLANNER_AGGREGATE_CRITERIA_SCHEMA
        }
      })
    });

    const parsed = parseJsonLoose<PlannerAggregateCriteriaResponse>(getGeminiText(response));
    const normalized = sanitizePlannerAggregateCriteriaResponse(parsed);
    return normalized ?? fallback;
  } catch {
    return fallback;
  }
}

function buildPlannerAggregateCriteriaPrompt(criteria: PlannerCriteriaAnswer[]): string {
  const criteriaSummary = criteria
    .map((entry, index) => {
      const budgetMax = typeof entry.budgetMax === "number" ? entry.budgetMax : entry.budgetMin;
      return [
        `Person ${index + 1}:`,
        `- availabilityMode: ${entry.availabilityMode}`,
        `- availability: ${entry.availability}`,
        `- budgetRange: ${entry.budgetMin}-${entry.budgetMax}`,
        `- vetoes: ${entry.vetoes.join(", ") || "none"}`,
        `- raw veto text: ${entry.vetoText ?? "none"}`
      ].join("\n");
    })
    .join("\n\n");

  return [
    "You are helping with group outing planning. Merge three people’s preferences into one aggregate profile.",
    "Return compact JSON matching the provided schema.",
    "",
    "From the inputs, infer:",
    "- budgetMin and budgetMax in GBP as integers.",
    "- availabilitySummary: a short phrase (max 80 chars) and proposedTime label for the whole group.",
    "- areaHints: up to 5 likely area preferences.",
    "- vibeHints: up to 7 likely vibe/category preferences.",
    "- vetoes: hard conflicts that should avoid items.",
    "- strictVetoes: only the most restrictive vetoes.",
    "- confidence: 0 to 1 with higher meaning clearer agreement.",
    "",
    `Criteria inputs:\n${criteriaSummary}`,
    "",
    "Prefer concise arrays and do not invent specific streets/restaurants."
  ].join("\n");
}

function sanitizePlannerAggregateCriteriaResponse(
  response: PlannerAggregateCriteriaResponse | null
): PlannerAggregateCriteria | null {
  if (!response) {
    return null;
  }

  const availabilitySummary = normalizePlannerText(response.availabilitySummary, 80) ?? "Anytime";
  const proposedTime = normalizePlannerText(response.proposedTime, 40) ?? deriveHeuristicProposedTime([]);
  const budgetMin = normalizePlannerNumericBounds(response.budgetMin, 0, PLANNER_AGGREGATE_BUDGET_CAP, 0);
  const budgetMax = normalizePlannerNumericBounds(response.budgetMax, 0, PLANNER_AGGREGATE_BUDGET_CAP, budgetMin);
  const areaHints = normalizePlannerAggregateStringHints(response.areaHints);
  const vibeHints = normalizePlannerAggregateStringHints(response.vibeHints);
  const vetoes = normalizePlannerAggregateStringHints(response.vetoes);
  const strictVetoes = normalizePlannerAggregateStringHints(response.strictVetoes).slice(0, 3);
  const confidence = normalizePlannerConfidence(response.confidence);

  return {
    version: 1,
    budgetMin,
    budgetMax: Math.max(budgetMin, budgetMax),
    availabilitySummary,
    proposedTime,
    areaHints,
    vibeHints,
    vetoes,
    strictVetoes,
    source: "gemini",
    confidence
  };
}

function buildFallbackPlannerAggregateCriteria(criteria: PlannerCriteriaAnswer[]): PlannerAggregateCriteria {
  const submitted = criteria.filter((entry) => entry.budgetMax > 0 || entry.vetoes.length > 0 || entry.availability.length > 0);
  if (submitted.length === 0) {
    return {
      version: 1,
      budgetMin: 0,
      budgetMax: PLANNER_AGGREGATE_BUDGET_CAP,
      availabilitySummary: "Whenever",
      proposedTime: "Saturday 12:00",
      areaHints: [],
      vibeHints: [],
      vetoes: [],
      strictVetoes: [],
      source: "heuristic"
    };
  }

  const budgetMins = submitted.map((entry) => entry.budgetMin);
  const budgetMaxes = submitted.map((entry) => entry.budgetMax);
  const budgetMin = budgetMins.length > 0 ? Math.max(0, Math.min(...budgetMins)) : 0;
  const budgetMax = budgetMaxes.length > 0 ? Math.max(0, Math.min(...budgetMaxes)) : PLANNER_AGGREGATE_BUDGET_CAP;
  const allVetoes = dedupePlannerTextArray(submitted.flatMap((entry) => entry.vetoes), 12);
  const strictVetoes = dedupePlannerTextArray(
    submitted.flatMap((entry) => entry.vetoes.map((veto) => (veto.length >= 8 ? veto : veto.toLowerCase()))),
    8
  );
  const proposedTime =
    submitted.every((entry) => entry.availability.toLowerCase().includes("sunday"))
      ? "Sunday 14:00"
      : submitted.every(
          (entry) => entry.availability.toLowerCase().includes("evening") || entry.availability.toLowerCase().includes("tonight")
        )
        ? "Friday 19:30"
        : "Saturday 12:00";

  const areaHints = dedupePlannerTextArray(submitted.map((entry) => entry.availability).slice(0, 5), 5);
  const vibeHints = dedupePlannerTextArray(submitted.flatMap((entry) => entry.vetoes), 7);

  return {
    version: 1,
    budgetMin,
    budgetMax,
    availabilitySummary: "Group consensus",
    proposedTime,
    areaHints,
    vibeHints,
    vetoes: allVetoes,
    strictVetoes,
    source: "heuristic"
  };
}

function normalizePlannerText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().replace(/\s+/g, " ");
  if (!text) {
    return null;
  }

  return text.slice(0, maxLength);
}

function normalizePlannerConfidence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.66;
}

function normalizePlannerNumericBounds(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  if (!Number.isInteger(value)) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  return Math.max(min, Math.min(max, value));
}

function normalizePlannerAggregateStringHints(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const hints: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = normalizePlannerText(entry, 60);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    hints.push(normalized);
    if (hints.length >= limit) {
      break;
    }
  }

  return hints;
}

function dedupePlannerTextArray(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(value.trim().slice(0, 60));
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function deriveHeuristicProposedTime(criteria: PlannerCriteriaAnswer[]): string {
  if (criteria.length === 0) {
    return "Saturday 12:00";
  }

  const normalized = criteria.map((entry) => entry.availability.toLowerCase());
  if (normalized.every((value) => value.includes("sunday"))) {
    return "Sunday 14:00";
  }

  if (normalized.every((value) => value.includes("after") || value.includes("tonight") || value.includes("evening"))) {
    return "Friday 19:30";
  }

  return "Saturday 12:00";
}

function buildGeminiExtractionPrompt(payload: ProviderCapturePayload): string {
  return [
    "Extract 1 to 3 candidate places from this SEAblings capture.",
    `Source type: ${payload.sourceType}`,
    shouldIncludeSourceUrlInPrompt(payload) ? `Source URL: ${payload.sourceUrl}` : null,
    payload.screenshotName ? `Screenshot name: ${payload.screenshotName}` : null,
    "Allowed categories: bakery, cafe, restaurant, bar, nightlife, activity, culture, shopping, other.",
    "Return JSON only matching the provided schema.",
    "Focus on low-stakes extraction only: candidate place name, short description, why it seems interesting, and an initial category.",
    "Do not invent exact address, postal code, opening hours, website or booking URL, or price tier. Leave optional fields blank when unknown.",
    payload.resolvedSourceMetadata ? "Use the resolved EnsembleData caption and media metadata as the primary evidence for this social capture." : null,
    "If information is unknown, use best-effort concise placeholders only for required summary fields.",
    "",
    "Capture content:",
    buildCaptureNarrative(payload)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildGeminiVideoExtractionPrompt(payload: ProviderCapturePayload): string {
  return [
    "Analyze this short-form social video and extract 1 to 3 candidate places from this SEAblings capture.",
    `Source type: ${payload.sourceType}`,
    shouldIncludeSourceUrlInPrompt(payload) ? `Source URL: ${payload.sourceUrl}` : null,
    payload.screenshotName ? `Screenshot name: ${payload.screenshotName}` : null,
    "Allowed categories: bakery, cafe, restaurant, bar, nightlife, activity, culture, shopping, other.",
    "Return JSON only matching the provided schema.",
    "Use the video media first, combining spoken audio/transcript, visible on-screen text, signage, overlays, and the resolved caption/source metadata as evidence.",
    "Do not rely on the bare social URL alone. For social captures, EnsembleData metadata is required before extraction.",
    "Focus on low-stakes extraction only: candidate place name, short description, why it seems interesting, and an initial category.",
    "Do not invent exact address, postal code, opening hours, website or booking URL, or price tier. Leave optional fields blank when unknown.",
    "If the video does not support a real place with enough evidence, return an empty places array.",
    "If information is unknown, use best-effort concise placeholders only for required summary fields.",
    "",
    "Capture content:",
    buildCaptureNarrative(payload)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPerplexityEnrichmentPrompt(place: ProviderPlaceExtraction, payload: ProviderCapturePayload): string {
  return [
    "Enrich this candidate place using focused web search and only return fields you can support with public sources.",
    "Return raw JSON only with these fields:",
    "canonicalName, description, whyInteresting, locationName, neighborhood, address, postalCode, priceEstimate, estimatedCost, openingHours, websiteUrl, sourceLinks, confidenceNote, dateHints, tags, categoryOverride, confidence",
    "canonicalName is the exact place name if verified.",
    "locationName is the broader area, district, or locality. neighborhood is the smaller local area if distinct.",
    "priceEstimate must be $, $$, or $$$. Use $ for free or very cheap only when supported.",
    "estimatedCost must be a single numeric estimate in local currency units when available.",
    "websiteUrl should be the official website or booking page when available.",
    "sourceLinks must contain the public source URLs you used.",
    "confidenceNote should briefly explain uncertainty, ambiguity, or data gaps.",
    "dateHints should be a short array of time-sensitive hints such as pop-up dates, seasonal windows, or booking lead times when relevant.",
    "tags must contain 3 to 5 concise descriptive lowercase tags and must not include system labels or source-platform labels.",
    "categoryOverride is optional and must be one of: bakery, cafe, restaurant, bar, nightlife, activity, culture, shopping, other.",
    "Do not invent missing details. Prefer omission plus a confidenceNote over guessing.",
    "",
    `Capture source type: ${payload.sourceType}`,
    shouldIncludeSourceUrlInPrompt(payload) ? `Capture source URL: ${payload.sourceUrl}` : null,
    `Current title: ${place.title}`,
    `Current locationName: ${place.locationName}`,
    `Current neighborhood: ${place.neighborhood}`,
    `Current category: ${place.category}`,
    `Current description: ${place.description}`,
    `Current whyInteresting: ${place.whyInteresting}`,
    `Current tags: ${place.tags.join(", ")}`,
    "",
    "Capture content:",
    buildCaptureNarrative(payload)
  ]
    .filter(Boolean)
    .join("\n");
}

async function requestGeminiExtractions(
  apiKey: string,
  payload: ProviderCapturePayload,
  parts: GeminiPart[]
): Promise<ProviderPlaceExtraction[]> {
  const response = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EXTRACTION_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: EXTRACTION_RESPONSE_SCHEMA
        }
      })
    },
    parts.some(isGeminiMediaPart) ? VIDEO_EXTRACTION_TIMEOUT_MS : REQUEST_TIMEOUT_MS
  );

  const rawText = getGeminiText(response);
  const parsed = parseJsonLoose<GeminiExtractionResponse>(rawText);
  if (!parsed?.places?.length) {
    return [];
  }

  return parsed.places
    .map((candidate) => sanitizeExtractedPlace(candidate, payload))
    .filter((candidate): candidate is ProviderPlaceExtraction => candidate !== null);
}

async function buildInlineVideoPart(videoUrl: string): Promise<GeminiPart | null> {
  const response = await fetch(videoUrl, {
    signal: AbortSignal.timeout(VIDEO_DOWNLOAD_TIMEOUT_MS)
  });

  if (!response.ok) {
    return null;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_INLINE_VIDEO_BYTES) {
    console.info("[Gemini Extraction] Inline video fallback skipped because the video is too large.");
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_INLINE_VIDEO_BYTES) {
    console.info("[Gemini Extraction] Inline video fallback skipped because the downloaded video is too large.");
    return null;
  }

  const mimeType = normalizeVideoMimeType(response.headers.get("content-type"));
  return {
    inline_data: {
      mime_type: mimeType,
      data: Buffer.from(arrayBuffer).toString("base64")
    }
  };
}

function buildPerplexityExactMatchRetryPrompt(
  place: ProviderPlaceExtraction,
  payload: ProviderCapturePayload,
  attempt: SanitizedPerplexityAttempt
): string {
  const missingFields = getMissingCoreFields(attempt);
  const canonicalMismatch = detectCanonicalMismatch(attempt.canonicalName, place);

  return [
    "Retry this enrichment with an exact-match check only.",
    "Do not broaden to nearby venues, sister locations, chain homepages, or category-level results.",
    "If you cannot verify this exact place, leave uncertain fields blank and explain the ambiguity in confidenceNote.",
    "Return raw JSON only using the same schema as before.",
    missingFields.length > 0 ? `Still needed core fields: ${missingFields.join(", ")}` : null,
    canonicalMismatch ? `The prior canonicalName looked mismatched: ${attempt.canonicalName ?? "unknown"}` : null,
    "",
    `Exact place title from capture: ${place.title}`,
    `Existing locationName: ${place.locationName}`,
    `Existing neighborhood: ${place.neighborhood}`,
    `Existing category: ${place.category}`,
    shouldIncludeSourceUrlInPrompt(payload) ? `Capture source URL: ${payload.sourceUrl}` : null,
    "",
    "Capture content:",
    buildCaptureNarrative(payload)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFallbackExtractions(payload: ProviderCapturePayload): ProviderPlaceExtraction[] {
  const narrative = buildCaptureNarrative(payload);
  const title = deriveTitle(payload);
  const category = inferPlaceCategory(narrative);
  const description = truncateText(
    payload.text?.trim() || `${title} surfaced from a ${payload.sourceType} capture and is ready for later review.`,
    260
  );
  const locationName = title;
  const neighborhood = deriveNeighborhood(narrative);
  const priceEstimate = inferPriceEstimate(narrative);
  const estimatedCost = inferEstimatedCost(priceEstimate);

  return [
    {
      title,
      description,
      whyInteresting: `Saved from a ${payload.sourceType} capture with enough detail to revisit later.`,
      locationName,
      neighborhood,
      priceEstimate,
      estimatedCost,
      tags: buildNormalizedTags([], buildTagSeed({ title, description, whyInteresting: "", neighborhood, category })),
      category,
      confidence: 0.46,
      provider: "fixture"
    }
  ];
}

function buildFallbackEnrichment(
  place: ProviderPlaceExtraction,
  payload: ProviderCapturePayload,
  confidenceNote?: string
): ProviderPlaceEnrichment {
  const categoryOverride = inferCategoryOverride(place, payload);

  return {
    tags: buildNormalizedTags(place.tags, buildTagSeed(place)),
    categoryOverride,
    confidence: Math.max(place.confidence, categoryOverride ? 0.58 : place.confidence),
    sourceLinks: normalizeSourceLinks([], payload.sourceUrl ? [payload.sourceUrl] : []),
    confidenceNote,
    status: "fallback",
    provider: "fixture"
  };
}

function inferCategoryOverride(place: ProviderPlaceExtraction, payload: ProviderCapturePayload): PlaceCategory | undefined {
  const inferred = inferPlaceCategory(`${place.title}\n${place.description}\n${buildCaptureNarrative(payload)}`, place.category);
  return inferred === place.category ? undefined : inferred;
}

function sanitizeExtractedPlace(value: Record<string, unknown>, payload: ProviderCapturePayload): ProviderPlaceExtraction | null {
  const narrative = buildCaptureNarrative(payload);
  const title = requiredText(value.title) ?? deriveTitle(payload);
  const description = optionalTrimmedString(value.description) ?? truncateText(narrative, 260);
  const whyInteresting =
    optionalTrimmedString(value.whyInteresting) ??
    `Saved from a ${payload.sourceType} capture that looks worth checking in person.`;
  const locationName = optionalTrimmedString(value.locationName) ?? title;
  const neighborhood = optionalTrimmedString(value.neighborhood) ?? deriveNeighborhood(narrative);
  const priceEstimate = normalizePriceEstimate(value.priceEstimate, inferPriceEstimate(narrative));
  const estimatedCost = normalizeEstimatedCost(value.estimatedCost, inferEstimatedCost(priceEstimate));
  const category = normalizePlaceCategory(value.category, inferPlaceCategory(`${title}\n${description}\n${whyInteresting}`));

  return {
    title,
    description: truncateText(description, 260),
    whyInteresting: truncateText(whyInteresting, 220),
    locationName,
    neighborhood,
    address: optionalTrimmedString(value.address),
    postalCode: optionalTrimmedString(value.postalCode),
    priceEstimate,
    estimatedCost,
    openingHours: optionalTrimmedString(value.openingHours),
    websiteUrl: optionalTrimmedString(value.websiteUrl),
    tags: buildNormalizedTags(value.tags, buildTagSeed({ title, description, whyInteresting, neighborhood, category })),
    category,
    confidence: normalizeConfidence(value.confidence, 0.72),
    provider: "gemini"
  };
}

function buildTagSeed(
  place: Pick<ProviderPlaceExtraction, "title" | "description" | "whyInteresting" | "neighborhood" | "category"> &
    Partial<Pick<ProviderPlaceExtraction, "tags">>
): string[] {
  return [
    ...(place.tags ?? []),
    place.category,
    neighborhoodKeyword(place.neighborhood),
    ...extractDescriptiveKeywords(`${place.title}\n${place.description}\n${place.whyInteresting}`)
  ].filter((value): value is string => Boolean(value));
}

async function fetchTikTokSourceMetadata(url: string | undefined, token: string): Promise<SocialCaptureMetadata> {
  if (!url) {
    throw new Error("TikTok capture is missing sourceUrl.");
  }

  const params = new URLSearchParams({ url, token });
  const response = await fetchExternalJson(`${ENSEMBLE_BASE_URL}/tt/post/info?${params}`);
  const posts: unknown[] = Array.isArray((response as TikTokResponse).data) ? ((response as TikTokResponse).data as unknown[]) : [];
  const post = posts[0];

  if (!isRecord(post)) {
    throw new Error("EnsembleData returned no TikTok post data.");
  }

  const awemeType = typeof post.aweme_type === "number" ? post.aweme_type : Number(post.aweme_type);
  const isCarousel = awemeType === 150;
  const imagePostInfo = isRecord(post.image_post_info) ? post.image_post_info : undefined;
  const video = isRecord(post.video) ? post.video : undefined;
  const author = isRecord(post.author) ? post.author : undefined;
  const imageUrls =
    isCarousel && imagePostInfo
      ? normalizeStringArray(
          Array.isArray(imagePostInfo.images)
            ? imagePostInfo.images.flatMap((entry) =>
                isRecord(entry) && isRecord(entry.display_image) ? normalizeStringArray(entry.display_image.url_list) : []
              )
            : []
        )
      : undefined;

  const thumbnail = isCarousel
    ? firstString(
        isRecord(imagePostInfo?.image_post_cover) && isRecord(imagePostInfo.image_post_cover.display_image)
          ? normalizeStringArray(imagePostInfo.image_post_cover.display_image.url_list)
          : []
      )
    : firstString(isRecord(video?.cover) ? normalizeStringArray(video.cover.url_list) : []);
  const videoUrl = firstString([
    ...(isRecord(video?.play_addr) ? normalizeStringArray(video.play_addr.url_list) : []),
    ...(isRecord(video?.download_addr) ? normalizeStringArray(video.download_addr.url_list) : [])
  ]);

  return {
    platform: "tiktok",
    contentType: isCarousel ? "carousel" : "video",
    caption: optionalTrimmedString(post.desc),
    authorHandle: optionalTrimmedString(author?.unique_id),
    authorDisplayName: optionalTrimmedString(author?.nickname),
    thumbnail,
    imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
    videoUrl,
    sourceUrl: url
  };
}

async function fetchInstagramSourceMetadata(url: string | undefined, token: string): Promise<SocialCaptureMetadata> {
  if (!url) {
    throw new Error("Instagram capture is missing sourceUrl.");
  }

  const code = extractInstagramShortcode(url);
  const params = new URLSearchParams({ code, n_comments_to_fetch: "0", token });
  const response = await fetchExternalJson(`${ENSEMBLE_BASE_URL}/instagram/post/details?${params}`);
  const post = (response as InstagramGraphQLResponse).data;

  if (!isRecord(post)) {
    throw new Error("EnsembleData returned no Instagram post data.");
  }

  const typename = typeof post.__typename === "string" ? post.__typename : "";
  const contentType: SocialContentType =
    typename === "GraphSidecar" ? "carousel" : typename === "GraphVideo" || Boolean(post.is_video) ? "video" : "image";
  const edgeMediaToCaption = isRecord(post.edge_media_to_caption) ? post.edge_media_to_caption : undefined;
  const owner = isRecord(post.owner) ? post.owner : undefined;
  const sidecar = isRecord(post.edge_sidecar_to_children) ? post.edge_sidecar_to_children : undefined;
  const captionEdges = Array.isArray(edgeMediaToCaption?.edges) ? edgeMediaToCaption.edges : [];
  const captionNode = captionEdges.find((entry) => isRecord(entry) && isRecord(entry.node) && typeof entry.node.text === "string");
  const caption = optionalTrimmedString(isRecord(captionNode) && isRecord(captionNode.node) ? captionNode.node.text : undefined);
  const imageUrls =
    contentType === "carousel" && Array.isArray(sidecar?.edges)
      ? normalizeStringArray(
          sidecar.edges.flatMap((entry) =>
            isRecord(entry) && isRecord(entry.node) ? [entry.node.display_url] : []
          )
        )
      : contentType === "image"
        ? normalizeStringArray([post.display_url])
        : undefined;

  return {
    platform: "instagram",
    contentType,
    caption,
    authorHandle: optionalTrimmedString(owner?.username),
    authorDisplayName: optionalTrimmedString(owner?.full_name) ?? optionalTrimmedString(owner?.username),
    thumbnail: optionalTrimmedString(post.thumbnail_src) ?? firstString(imageUrls),
    imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
    videoUrl: contentType === "video" ? optionalTrimmedString(post.video_url) : undefined,
    sourceUrl: url
  };
}

function buildSocialMetadataNarrative(metadata: SocialCaptureMetadata): string[] {
  return [
    "Resolved social metadata from EnsembleData:",
    `Platform: ${titleCase(metadata.platform)}`,
    `Content type: ${metadata.contentType}`,
    metadata.authorHandle ? `Author handle: @${metadata.authorHandle.replace(/^@/, "")}` : null,
    metadata.authorDisplayName ? `Author display name: ${metadata.authorDisplayName}` : null,
    metadata.caption ? `Caption: ${metadata.caption}` : "Caption: [none provided]",
    metadata.thumbnail ? `Thumbnail URL: ${metadata.thumbnail}` : null,
    metadata.imageUrls?.length ? `Image URLs: ${metadata.imageUrls.join(", ")}` : null,
    metadata.videoUrl ? "Video media: included inline after server-side download" : null,
    `Original source URL: ${metadata.sourceUrl}`
  ].filter((value): value is string => Boolean(value));
}

function buildCaptureNarrative(payload: ProviderCapturePayload): string {
  const parts = [
    payload.text?.trim(),
    payload.resolvedSourceMetadata ? buildSocialMetadataNarrative(payload.resolvedSourceMetadata).join("\n") : null,
    shouldIncludeSourceUrlInNarrative(payload) ? payload.sourceUrl?.trim() : null,
    payload.screenshotName?.trim()
  ].filter((value): value is string => Boolean(value));

  return parts.join("\n").trim() || `${payload.sourceType} capture`;
}

function deriveTitle(payload: ProviderCapturePayload): string {
  const fromText = payload.text?.trim();
  if (fromText) {
    const firstLine = fromText.split(/\r?\n/)[0]?.trim();
    if (firstLine) {
      return truncateText(stripLeadingHandle(firstLine), 80);
    }
  }

  const metadataCaption = payload.resolvedSourceMetadata?.caption?.trim();
  if (metadataCaption) {
    const firstLine = metadataCaption.split(/\r?\n/)[0]?.trim();
    if (firstLine) {
      return truncateText(stripLeadingHandle(firstLine), 80);
    }
  }

  const metadataAuthor = payload.resolvedSourceMetadata?.authorDisplayName ?? payload.resolvedSourceMetadata?.authorHandle;
  if (metadataAuthor) {
    return truncateText(`${titleCase(payload.sourceType)} capture from ${metadataAuthor.replace(/^@/, "")}`, 80);
  }

  const url = safeUrl(payload.sourceUrl);
  if (url) {
    const slug = url.pathname
      .split("/")
      .filter(Boolean)
      .pop();

    if (slug) {
      return truncateText(titleCase(slug.replace(/[-_]+/g, " ")), 80);
    }

    return truncateText(titleCase(url.hostname.replace(/^www\./, "")), 80);
  }

  if (payload.screenshotName) {
    return truncateText(titleCase(payload.screenshotName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ")), 80);
  }

  return `${titleCase(payload.sourceType)} find`;
}

function isSocialCaptureWithUrl(payload: CapturePayload): payload is CapturePayload & { sourceUrl: string } {
  return (payload.sourceType === "tiktok" || payload.sourceType === "instagram") && typeof payload.sourceUrl === "string";
}

function isUrlOnlySocialCapture(payload: CapturePayload): boolean {
  return isSocialCaptureWithUrl(payload) && !payload.text?.trim() && !payload.screenshotName?.trim() && !payload.screenshotBase64?.trim();
}

function shouldIncludeSourceUrlInNarrative(payload: ProviderCapturePayload): boolean {
  return payload.sourceType !== "tiktok" && payload.sourceType !== "instagram" ? true : Boolean(payload.resolvedSourceMetadata);
}

function shouldIncludeSourceUrlInPrompt(payload: ProviderCapturePayload): boolean {
  return Boolean(payload.sourceUrl) && shouldIncludeSourceUrlInNarrative(payload);
}

function extractInstagramShortcode(url: string): string {
  const patterns = [
    /instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/i,
    /instagr\.am\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  throw new Error("Could not extract Instagram shortcode from capture URL.");
}

function deriveNeighborhood(text: string): string {
  const matches = text.match(/\b(?:in|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
  if (matches?.[1]) {
    return matches[1];
  }

  return "Unknown";
}

function inferPriceEstimate(text: string): PriceTier {
  if (/\bfree\b/i.test(text)) {
    return "$";
  }

  if (/\bcheap\b|\bbudget\b|\bunder \$?\d+/i.test(text)) {
    return "$";
  }

  if (/\bluxury\b|\bexpensive\b|\bfine dining\b/i.test(text)) {
    return "$$$";
  }

  return "$$";
}

function inferEstimatedCost(priceEstimate: PriceTier): number {
  switch (priceEstimate) {
    case "$":
      return 15;
    case "$$$":
      return 60;
    default:
      return 30;
  }
}

async function requestPerplexityEnrichment(
  apiKey: string,
  prompt: string
): Promise<SanitizedPerplexityAttempt | null> {
  const response = await fetchJson("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      temperature: 0.1,
      search_mode: "web",
      return_images: true,
      image_format_filter: ["jpg", "jpeg", "png", "webp"],
      max_tokens: 700,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "place_enrichment",
          schema: PERPLEXITY_ENRICHMENT_SCHEMA
        }
      },
      messages: [
        {
          role: "system",
          content:
            "You enrich candidate places found in short-form social content. Use cited public sources, do not invent details, and return JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const rawText = getPerplexityText(response);
  const parsed = parseJsonLoose<PerplexityEnrichmentResponse>(rawText);
  if (!parsed) {
    return null;
  }

  return sanitizePerplexityAttempt(parsed, extractPerplexityCitations(response), extractPerplexityImageResult(response));
}

function sanitizePerplexityAttempt(
  parsed: PerplexityEnrichmentResponse,
  citations: string[],
  imageResult?: PerplexityImageResult | null
): SanitizedPerplexityAttempt {
  const estimatedCost = normalizeEstimatedCost(parsed.estimatedCost);
  const priceEstimate = normalizePriceTier(parsed.priceEstimate, estimatedCost);
  const canonicalName = requiredText(parsed.canonicalName);
  const description = optionalTrimmedString(parsed.description);
  const whyInteresting = optionalTrimmedString(parsed.whyInteresting);
  const locationName = optionalTrimmedString(parsed.locationName);
  const neighborhood = optionalTrimmedString(parsed.neighborhood);
  const categoryOverride = optionalPlaceCategory(parsed.categoryOverride);

  return {
    canonicalName,
    description,
    whyInteresting,
    locationName,
    neighborhood,
    address: optionalTrimmedString(parsed.address),
    postalCode: optionalTrimmedString(parsed.postalCode),
    priceEstimate,
    estimatedCost,
    openingHours: optionalTrimmedString(parsed.openingHours),
    websiteUrl: optionalTrimmedString(parsed.websiteUrl),
    photoUrl: imageResult?.photoUrl,
    photoSourceLinks: imageResult?.photoSourceLinks,
    sourceLinks: normalizeSourceLinks(parsed.sourceLinks, citations),
    confidenceNote: optionalTrimmedString(parsed.confidenceNote),
    dateHints: normalizeDateHints(parsed.dateHints),
    tags: buildNormalizedTags(
      parsed.tags,
      buildTagSeed({
        title: canonicalName ?? locationName ?? "place",
        description: description ?? "",
        whyInteresting: whyInteresting ?? "",
        neighborhood: neighborhood ?? "Unknown",
        category: categoryOverride ?? "other"
      })
    ),
    categoryOverride,
    confidence: normalizeConfidence(parsed.confidence, 0.72)
  };
}

function shouldRetryPerplexityEnrichment(
  attempt: SanitizedPerplexityAttempt,
  place: ProviderPlaceExtraction
): boolean {
  return getMissingCoreFields(attempt).length > 0 || detectCanonicalMismatch(attempt.canonicalName, place);
}

function mergePerplexityAttempts(
  base: SanitizedPerplexityAttempt,
  retry: SanitizedPerplexityAttempt
): SanitizedPerplexityAttempt {
  return {
    canonicalName: retry.canonicalName ?? base.canonicalName,
    description: retry.description ?? base.description,
    whyInteresting: retry.whyInteresting ?? base.whyInteresting,
    locationName: retry.locationName ?? base.locationName,
    neighborhood: retry.neighborhood ?? base.neighborhood,
    address: retry.address ?? base.address,
    postalCode: retry.postalCode ?? base.postalCode,
    priceEstimate: retry.priceEstimate ?? base.priceEstimate,
    estimatedCost: retry.estimatedCost ?? base.estimatedCost,
    openingHours: retry.openingHours ?? base.openingHours,
    websiteUrl: retry.websiteUrl ?? base.websiteUrl,
    photoUrl: retry.photoUrl ?? base.photoUrl,
    photoSourceLinks: normalizeSourceLinks([...(base.photoSourceLinks ?? []), ...(retry.photoSourceLinks ?? [])]),
    sourceLinks: normalizeSourceLinks([...base.sourceLinks, ...retry.sourceLinks]),
    confidenceNote: retry.confidenceNote ?? base.confidenceNote,
    dateHints: normalizeDateHints([...(base.dateHints ?? []), ...(retry.dateHints ?? [])]),
    tags: buildNormalizedTags([...base.tags, ...retry.tags], [...base.tags, ...retry.tags]),
    categoryOverride: retry.categoryOverride ?? base.categoryOverride,
    confidence: Math.max(base.confidence ?? 0, retry.confidence ?? 0)
  };
}

function finalizePerplexityEnrichment(
  attempt: SanitizedPerplexityAttempt,
  place: ProviderPlaceExtraction
): ProviderPlaceEnrichment {
  const missingCoreFields = getMissingCoreFields(attempt);
  const canonicalMismatch = detectCanonicalMismatch(attempt.canonicalName, place);
  const confidenceNote = buildEnrichmentConfidenceNote(
    attempt.confidenceNote,
    missingCoreFields,
    canonicalMismatch,
    attempt.dateHints
  );

  return {
    canonicalName: canonicalMismatch ? undefined : attempt.canonicalName,
    description: attempt.description,
    whyInteresting: attempt.whyInteresting,
    locationName: attempt.locationName,
    neighborhood: attempt.neighborhood,
    address: attempt.address,
    postalCode: attempt.postalCode,
    priceEstimate: attempt.priceEstimate,
    estimatedCost: attempt.estimatedCost,
    openingHours: attempt.openingHours,
    websiteUrl: attempt.websiteUrl,
    photoUrl: attempt.photoUrl,
    photoSourceLinks: attempt.photoSourceLinks,
    sourceLinks: attempt.sourceLinks,
    confidenceNote,
    dateHints: attempt.dateHints,
    tags: attempt.tags.length > 0 ? attempt.tags : buildNormalizedTags(place.tags, buildTagSeed(place)),
    categoryOverride: attempt.categoryOverride,
    confidence: attempt.confidence,
    status: missingCoreFields.length === 0 && !canonicalMismatch ? "complete" : "partial",
    provider: "perplexity"
  };
}

function getMissingCoreFields(attempt: SanitizedPerplexityAttempt): string[] {
  return ENRICHMENT_CORE_FIELDS.filter((field) => !attempt[field]);
}

function detectCanonicalMismatch(
  canonicalName: string | undefined,
  place: Pick<ProviderPlaceExtraction, "title" | "locationName">
): boolean {
  if (!canonicalName) {
    return false;
  }

  const normalizedCanonical = comparableName(canonicalName);
  const normalizedTitle = comparableName(place.title);
  const normalizedLocation = comparableName(place.locationName);

  if (!normalizedCanonical || !normalizedTitle) {
    return false;
  }

  if (
    normalizedCanonical === normalizedTitle ||
    normalizedCanonical.includes(normalizedTitle) ||
    normalizedTitle.includes(normalizedCanonical) ||
    (normalizedLocation && (normalizedCanonical === normalizedLocation || normalizedCanonical.includes(normalizedLocation)))
  ) {
    return false;
  }

  const canonicalTokens = new Set(normalizedCanonical.split(" ").filter((token) => token.length >= 3));
  const titleTokens = new Set(normalizedTitle.split(" ").filter((token) => token.length >= 3));
  const overlap = [...canonicalTokens].filter((token) => titleTokens.has(token));

  return overlap.length === 0;
}

function comparableName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\b(the|restaurant|cafe|bar|bakery|club|hotel|official)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEnrichmentConfidenceNote(
  existingNote: string | undefined,
  missingCoreFields: string[],
  canonicalMismatch: boolean,
  dateHints: string[] | undefined
): string | undefined {
  const notes = [
    existingNote,
    missingCoreFields.length > 0 ? `Missing verified fields: ${missingCoreFields.join(", ")}.` : undefined,
    canonicalMismatch ? "Canonical name looked mismatched, so the captured title was kept." : undefined,
    dateHints?.length ? `Date hints: ${dateHints.join("; ")}.` : undefined
  ]
    .map((value) => optionalTrimmedString(value))
    .filter((value): value is string => Boolean(value));

  if (notes.length === 0) {
    return undefined;
  }

  return truncateText(notes.join(" "), 280);
}

function normalizeSourceLinks(value: unknown, fallback: string[] = []): string[] {
  const candidates = Array.isArray(value) ? value : [];
  const merged = [...candidates, ...fallback];
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const candidate of merged) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = candidate.trim();
    if (!normalized) {
      continue;
    }

    const url = safeUrl(normalized);
    if (!url) {
      continue;
    }

    const href = url.toString();
    if (seen.has(href)) {
      continue;
    }

    seen.add(href);
    deduped.push(href);
  }

  return deduped.slice(0, 6);
}

async function requestPerplexityImages(apiKey: string, prompt: string): Promise<unknown> {
  return fetchJson("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      temperature: 0.1,
      search_mode: "web",
      return_images: true,
      image_format_filter: ["jpg", "jpeg", "png", "webp"],
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content: "Find a representative public image for the exact place. Return a concise answer; image metadata is read from the API response."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });
}

function buildPerplexityPhotoPrompt(
  place: Pick<ProviderPlaceExtraction, "title" | "locationName" | "neighborhood" | "address" | "websiteUrl">
): string {
  return [
    "Find one representative public photo for this exact place.",
    "Prefer official venue, publisher, or map/listing images over generic stock photos.",
    "Do not broaden to unrelated locations with similar names.",
    "",
    `Title: ${place.title}`,
    `Location name: ${place.locationName}`,
    `Neighborhood: ${place.neighborhood}`,
    place.address ? `Address: ${place.address}` : null,
    place.websiteUrl ? `Website: ${place.websiteUrl}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function extractPerplexityImageResult(response: unknown): PerplexityImageResult | null {
  try {
    if (!isRecord(response) || !Array.isArray(response.images)) {
      return null;
    }

    const sources: string[] = [];
    for (const image of response.images as PerplexityImage[]) {
      if (!isRecord(image)) {
        continue;
      }

      const imageUrl = normalizeDirectImageUrl(image.image_url);
      if (!imageUrl) {
        continue;
      }

      sources.push(...normalizeSourceLinks([image.origin_url, imageUrl]));
      return {
        photoUrl: imageUrl,
        photoSourceLinks: normalizeSourceLinks(sources)
      };
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeDirectImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const url = safeUrl(value.trim());
  if (!url || !isHttpUrl(url)) {
    return undefined;
  }

  const pathname = url.pathname.toLowerCase();
  if (!/\.(?:jpe?g|png|webp|gif)(?:$|\?)/.test(pathname) && !pathname.includes("/image")) {
    return undefined;
  }

  return url.toString();
}

function normalizeDateHints(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = truncateText(entry.trim(), 80);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped.length > 0 ? deduped.slice(0, 4) : undefined;
}

function extractPerplexityCitations(response: unknown): string[] {
  if (!isRecord(response)) {
    return [];
  }

  const topLevel = Array.isArray(response.citations) ? response.citations : [];
  const firstChoice = Array.isArray(response.choices) ? response.choices[0] : null;
  const messageCitations =
    isRecord(firstChoice) && isRecord(firstChoice.message) && Array.isArray(firstChoice.message.citations)
      ? firstChoice.message.citations
      : [];

  return normalizeSourceLinks([...topLevel, ...messageCitations]);
}

function normalizeEmbeddingValues(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
}

function normalizePriceEstimate(value: unknown, fallback: PriceTier): PriceTier {
  return normalizePriceTier(value, undefined, fallback);
}

function normalizePriceTier(rawValue: unknown, estimatedCost?: number, fallback: PriceTier = "$$"): PriceTier {
  if (typeof estimatedCost === "number" && Number.isFinite(estimatedCost) && estimatedCost >= 0) {
    if (estimatedCost <= 25) {
      return "$";
    }

    if (estimatedCost <= 75) {
      return "$$";
    }

    return "$$$";
  }

  if (typeof rawValue !== "string") {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (normalized.includes("free")) {
    return "$";
  }

  if (normalized === "$" || normalized === "£" || normalized.includes("cheap") || normalized.includes("budget")) {
    return "$";
  }

  if (
    normalized === "$$$" ||
    normalized === "£££" ||
    normalized.includes("luxury") ||
    normalized.includes("fine dining") ||
    normalized.includes("expensive")
  ) {
    return "$$$";
  }

  if (
    normalized === "$$" ||
    normalized === "££" ||
    normalized.includes("moderate") ||
    normalized.includes("mid")
  ) {
    return "$$";
  }

  const currencyTier = normalized.replace(/[^$£]/g, "");
  if (currencyTier.length >= 3) {
    return "$$$";
  }

  if (currencyTier.length === 2) {
    return "$$";
  }

  if (currencyTier.length === 1) {
    return "$";
  }

  return fallback;
}

function normalizeEstimatedCost(value: unknown, fallback?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.round(value);
}

function optionalPlaceCategory(value: unknown): PlaceCategory | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return normalizePlaceCategory(value);
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function requiredText(value: unknown): string | undefined {
  const normalized = optionalTrimmedString(value);
  return normalized ? truncateText(normalized, 80) : undefined;
}

function buildNormalizedTags(tags: unknown, seed: string[] = []): string[] {
  const normalized = normalizePlaceTags(tags, seed).filter((tag) => !RESERVED_TAGS.has(tag));
  if (normalized.length >= 3) {
    return normalized.slice(0, 5);
  }

  const fallbackKeywords = seed
    .map((value) => slugToken(value))
    .filter((value): value is string => Boolean(value))
    .filter((value) => !RESERVED_TAGS.has(value));

  return normalizePlaceTags(normalized, fallbackKeywords)
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

function createContentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stripLeadingHandle(value: string): string {
  return value.replace(/^@\S+\s+/, "").trim();
}

function slugToken(value: string): string | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length >= 2 ? normalized : null;
}

function safeUrl(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return isHttpUrl(url) ? url : null;
  } catch {
    return null;
  }
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const normalized = optionalTrimmedString(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function firstString(values: string[] | undefined): string | undefined {
  return Array.isArray(values) ? values.find((value) => value.length > 0) : undefined;
}

function isGeminiMediaPart(part: GeminiPart): boolean {
  return "inline_data" in part;
}

function normalizeVideoMimeType(value: string | null): string {
  if (!value) {
    return "video/mp4";
  }

  const mimeType = value.split(";")[0]?.trim().toLowerCase();
  return mimeType?.startsWith("video/") ? mimeType : "video/mp4";
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Provider request failed with ${response.status}: ${truncateText(text, 200)}`);
  }

  return text ? (JSON.parse(text) as unknown) : {};
}

async function fetchExternalJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`External metadata request failed with status ${response.status}.`);
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : {};
}

function getGeminiText(response: unknown): string {
  if (!isRecord(response)) {
    return "";
  }

  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  const candidate = candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    return "";
  }

  const firstPart = candidate.content.parts[0];
  return isRecord(firstPart) && typeof firstPart.text === "string" ? firstPart.text : "";
}

function getPerplexityText(response: unknown): string {
  if (!isRecord(response) || !Array.isArray(response.choices)) {
    return "";
  }

  const choice = response.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    return "";
  }

  return choice.message.content;
}

function parseJsonLoose<T>(value: string): T | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const direct = tryParseJson<T>(trimmed);
  if (direct) {
    return direct;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParseJson<T>(fenced[1].trim());
    if (parsed) {
      return parsed;
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return tryParseJson<T>(trimmed.slice(objectStart, objectEnd + 1));
  }

  return null;
}

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

const EXTRACTION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    places: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          whyInteresting: { type: "string" },
          locationName: { type: "string" },
          neighborhood: { type: "string" },
          address: { type: "string" },
          postalCode: { type: "string" },
          priceEstimate: { type: "string" },
          estimatedCost: { type: "number" },
          openingHours: { type: "string" },
          websiteUrl: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" }
          },
          category: {
            type: "string",
            enum: ["bakery", "cafe", "restaurant", "bar", "nightlife", "activity", "culture", "shopping", "other"]
          },
          confidence: { type: "number" }
        },
        required: ["title", "description", "whyInteresting", "locationName", "neighborhood", "tags", "category", "confidence"]
      }
    }
  },
  required: ["places"]
};

const PLANNER_AGGREGATE_CRITERIA_SCHEMA = {
  type: "object",
  properties: {
    budgetMin: { type: "number" },
    budgetMax: { type: "number" },
    availabilitySummary: { type: "string" },
    proposedTime: { type: "string" },
    areaHints: {
      type: "array",
      items: { type: "string" }
    },
    vibeHints: {
      type: "array",
      items: { type: "string" }
    },
    vetoes: {
      type: "array",
      items: { type: "string" }
    },
    strictVetoes: {
      type: "array",
      items: { type: "string" }
    },
    source: { type: "string", enum: ["gemini"] },
    confidence: { type: "number" }
  },
  required: ["budgetMin", "budgetMax"]
};

const PERPLEXITY_ENRICHMENT_SCHEMA = {
  type: "object",
  properties: {
    canonicalName: { type: "string" },
    description: { type: "string" },
    whyInteresting: { type: "string" },
    locationName: { type: "string" },
    neighborhood: { type: "string" },
    address: { type: "string" },
    postalCode: { type: "string" },
    priceEstimate: { type: "string" },
    estimatedCost: { type: "number" },
    openingHours: { type: "string" },
    websiteUrl: { type: "string" },
    sourceLinks: {
      type: "array",
      items: { type: "string" }
    },
    confidenceNote: { type: "string" },
    dateHints: {
      type: "array",
      items: { type: "string" }
    },
    tags: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5
    },
    categoryOverride: {
      type: "string",
      enum: ["bakery", "cafe", "restaurant", "bar", "nightlife", "activity", "culture", "shopping", "other"]
    },
    confidence: { type: "number" }
  },
  required: ["tags", "confidence"]
};
