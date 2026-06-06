import type {
  BucketCategory,
  BucketItemDateType,
  BucketItemStatus,
  CapturePayload,
  IngestionTaskStatus,
  PersonaId,
  SourcePlatform
} from "@/lib/domain";
import { personas } from "@/lib/fixtures";

export class ValidationError extends Error {}

const personaIds = new Set<PersonaId>(personas.map((persona) => persona.id));
const sourcePlatforms = new Set<SourcePlatform>(["tiktok", "instagram", "screenshot", "manual", "text"]);
const taskStatuses = new Set<IngestionTaskStatus>([
  "queued",
  "processing",
  "extracting",
  "enriching",
  "embedding",
  "completed",
  "failed"
]);
const bucketItemStatuses = new Set<BucketItemStatus>([
  "candidate",
  "saved",
  "completed",
  "rejected",
  "archived"
]);
const bucketCategories = new Set<BucketCategory>([
  "eats",
  "drinks",
  "cafe",
  "nightlife",
  "activity",
  "culture",
  "hidden_gem",
  "market",
  "other"
]);
const bucketItemDateTypes = new Set<BucketItemDateType>(["anytime", "one_off", "limited_run", "scheduled"]);

export type ListCaptureFilters = {
  userId?: PersonaId;
  status?: IngestionTaskStatus;
};

export type ListBucketItemFilters = {
  userId?: PersonaId;
  status?: BucketItemStatus;
};

export type ManualBucketItemInput = {
  userId: PersonaId;
  title: string;
  category: BucketCategory;
  description: string;
  whyInteresting: string;
  locationName: string;
  neighborhood: string;
  priceEstimate: string;
  status?: BucketItemStatus;
  dateType?: BucketItemDateType;
  address?: string;
  postalCode?: string;
  estimatedCost?: number;
  openingHours?: string;
  websiteUrl?: string;
  sourceUrl?: string;
  sourceType?: SourcePlatform;
  tags?: string[];
  confidence?: number;
  startsAt?: string;
  endsAt?: string;
};

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === "string" && personaIds.has(value as PersonaId);
}

export function isSourcePlatform(value: unknown): value is SourcePlatform {
  return typeof value === "string" && sourcePlatforms.has(value as SourcePlatform);
}

export function isIngestionTaskStatus(value: unknown): value is IngestionTaskStatus {
  return typeof value === "string" && taskStatuses.has(value as IngestionTaskStatus);
}

export function isBucketItemStatus(value: unknown): value is BucketItemStatus {
  return typeof value === "string" && bucketItemStatuses.has(value as BucketItemStatus);
}

export function parseCapturePayload(value: unknown): CapturePayload {
  if (!isRecord(value)) {
    throw new ValidationError("Capture payload must be a JSON object.");
  }

  const userId = value.userId;
  const sourceType = value.sourceType;
  const sourceUrl = optionalString(value.sourceUrl);
  const text = optionalString(value.text);
  const screenshotName = optionalString(value.screenshotName);
  const screenshotBase64 = optionalString(value.screenshotBase64);

  if (!isPersonaId(userId)) {
    throw new ValidationError("Capture payload requires a valid userId.");
  }

  if (!isSourcePlatform(sourceType)) {
    throw new ValidationError("Capture payload requires a valid sourceType.");
  }

  if (!sourceUrl && !text && !screenshotName && !screenshotBase64) {
    throw new ValidationError("Capture payload requires sourceUrl, text, or screenshot data.");
  }

  if ((sourceType === "tiktok" || sourceType === "instagram") && !sourceUrl) {
    throw new ValidationError(`${sourceType} captures require sourceUrl.`);
  }

  if (sourceType === "text" && !text) {
    throw new ValidationError("Text captures require text.");
  }

  if (sourceType === "screenshot" && !screenshotName && !screenshotBase64) {
    throw new ValidationError("Screenshot captures require screenshotName or screenshotBase64.");
  }

  return {
    userId,
    sourceType,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(text ? { text } : {}),
    ...(screenshotName ? { screenshotName } : {}),
    ...(screenshotBase64 ? { screenshotBase64 } : {})
  };
}

export function parseCaptureFilters(searchParams: URLSearchParams): ListCaptureFilters {
  const userId = searchParams.get("userId");
  const status = searchParams.get("status");
  const filters: ListCaptureFilters = {};

  if (userId) {
    if (!isPersonaId(userId)) {
      throw new ValidationError("Invalid userId filter.");
    }

    filters.userId = userId;
  }

  if (status) {
    if (!isIngestionTaskStatus(status)) {
      throw new ValidationError("Invalid status filter.");
    }

    filters.status = status;
  }

  return filters;
}

export function parseBucketItemFilters(searchParams: URLSearchParams): ListBucketItemFilters {
  const userId = searchParams.get("userId");
  const status = searchParams.get("status");
  const filters: ListBucketItemFilters = {};

  if (userId) {
    if (!isPersonaId(userId)) {
      throw new ValidationError("Invalid userId filter.");
    }

    filters.userId = userId;
  }

  if (status) {
    if (!isBucketItemStatus(status)) {
      throw new ValidationError("Invalid status filter.");
    }

    filters.status = status;
  }

  return filters;
}

export function parseBucketItemStatus(value: unknown): BucketItemStatus {
  if (!isRecord(value) || !isBucketItemStatus(value.status)) {
    throw new ValidationError("PATCH body requires a valid status.");
  }

  return value.status;
}

export function parseManualBucketItemInput(value: unknown): ManualBucketItemInput {
  if (!isRecord(value)) {
    throw new ValidationError("Bucket item payload must be a JSON object.");
  }

  if (!isPersonaId(value.userId)) {
    throw new ValidationError("Bucket item requires a valid userId.");
  }

  const title = requiredString(value.title, "title");
  const description = requiredString(value.description, "description");
  const whyInteresting = requiredString(value.whyInteresting, "whyInteresting");
  const locationName = requiredString(value.locationName, "locationName");
  const neighborhood = requiredString(value.neighborhood, "neighborhood");
  const priceEstimate = requiredString(value.priceEstimate, "priceEstimate");

  if (typeof value.category !== "string" || !bucketCategories.has(value.category as BucketCategory)) {
    throw new ValidationError("Bucket item requires a valid category.");
  }

  const status = value.status;
  if (status !== undefined && !isBucketItemStatus(status)) {
    throw new ValidationError("Bucket item status is invalid.");
  }

  const dateType = value.dateType;
  if (dateType !== undefined && (typeof dateType !== "string" || !bucketItemDateTypes.has(dateType as BucketItemDateType))) {
    throw new ValidationError("Bucket item dateType is invalid.");
  }

  const sourceType = value.sourceType;
  if (sourceType !== undefined && !isSourcePlatform(sourceType)) {
    throw new ValidationError("Bucket item sourceType is invalid.");
  }

  return {
    userId: value.userId,
    title,
    description,
    whyInteresting,
    locationName,
    neighborhood,
    priceEstimate,
    category: value.category as BucketCategory,
    status: status ?? "candidate",
    dateType: (dateType as BucketItemDateType | undefined) ?? "anytime",
    address: optionalString(value.address),
    postalCode: optionalString(value.postalCode),
    openingHours: optionalString(value.openingHours),
    websiteUrl: optionalString(value.websiteUrl),
    sourceUrl: optionalString(value.sourceUrl),
    sourceType: (sourceType as SourcePlatform | undefined) ?? "manual",
    tags: normalizeTags(value.tags),
    confidence: normalizeConfidence(value.confidence),
    estimatedCost: normalizeEstimatedCost(value.estimatedCost),
    startsAt: optionalString(value.startsAt),
    endsAt: optionalString(value.endsAt)
  };
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Bucket item requires ${fieldName}.`);
  }

  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeEstimatedCost(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.7;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
