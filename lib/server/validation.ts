import {
  bucketItemEnrichmentStatusValues,
  bucketCategoryValues,
  type BucketCategory,
  type BucketItemDateType,
  type BucketItemEnrichmentStatus,
  type BucketItemStatus,
  type CapturePayload,
  type IngestionTaskStatus,
  type PlannerParticipantId,
  type PersonaId,
  type PriceEstimateTier,
  type SourcePlatform
} from "@/lib/domain";
import { personas } from "@/lib/fixtures";

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class ConflictError extends Error {}
export class AuthorizationError extends Error {}

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
const bucketCategories = new Set<BucketCategory>(bucketCategoryValues);
const bucketItemDateTypes = new Set<BucketItemDateType>(["anytime", "one_off", "limited_run", "scheduled"]);
const bucketItemEnrichmentStatuses = new Set<BucketItemEnrichmentStatus>(bucketItemEnrichmentStatusValues);

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
  enrichmentProvider?: string;
  enrichmentStatus?: BucketItemEnrichmentStatus;
  enrichmentSourceLinks?: string[];
  enrichmentConfidenceNote?: string;
  status?: BucketItemStatus;
  dateType?: BucketItemDateType;
  address?: string;
  postalCode?: string;
  estimatedCost?: number;
  openingHours?: string;
  websiteUrl?: string;
  photoUrl?: string;
  photoSourceLinks?: string[];
  sourceUrl?: string;
  sourceType?: SourcePlatform;
  tags?: string[];
  confidence?: number;
  startsAt?: string;
  endsAt?: string;
};

export type DemoLoginInput = {
  personaId: PersonaId;
  pin: string;
};

export type ListZymixMessageFilters = {
  threadId: string;
};

export type CreateZymixMessageInput = {
  threadId: string;
  text: string;
};

export type PlannerSessionFilters = {
  threadId: string;
};

export type SubmitPlannerCriteriaInput = {
  threadId: string;
  availabilityMode: "Whenever" | "Custom";
  availability: string;
  budgetMode: "slider" | "text";
  budgetAmount: number;
  budgetOption?: string;
  budgetText?: string;
  vetoText?: string;
  vetoes: string[];
};

export type SubmitPlannerVoteInput = {
  threadId: string;
  bucketItemIds: string[];
};

export type CancelPlannerSessionInput = {
  threadId: string;
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
  const priceEstimate = normalizePriceEstimate(requiredString(value.priceEstimate, "priceEstimate"));

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

  const enrichmentStatus = normalizeEnrichmentStatus(value.enrichmentStatus);
  if (value.enrichmentStatus !== undefined && !enrichmentStatus) {
    throw new ValidationError("Bucket item enrichmentStatus is invalid.");
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
    enrichmentProvider: optionalString(value.enrichmentProvider),
    enrichmentStatus,
    enrichmentSourceLinks: normalizeStringArray(value.enrichmentSourceLinks),
    enrichmentConfidenceNote: optionalString(value.enrichmentConfidenceNote),
    status: status ?? "candidate",
    dateType: (dateType as BucketItemDateType | undefined) ?? "anytime",
    address: optionalString(value.address),
    postalCode: optionalString(value.postalCode),
    openingHours: optionalString(value.openingHours),
    websiteUrl: optionalString(value.websiteUrl),
    photoUrl: optionalHttpUrl(value.photoUrl),
    photoSourceLinks: normalizeHttpUrlArray(value.photoSourceLinks),
    sourceUrl: optionalString(value.sourceUrl),
    sourceType: (sourceType as SourcePlatform | undefined) ?? "manual",
    tags: normalizeTags(value.tags),
    confidence: normalizeConfidence(value.confidence),
    estimatedCost: normalizeEstimatedCost(value.estimatedCost),
    startsAt: optionalString(value.startsAt),
    endsAt: optionalString(value.endsAt)
  };
}

export function parseDemoLoginInput(value: unknown): DemoLoginInput {
  if (!isRecord(value)) {
    throw new ValidationError("Login payload must be a JSON object.");
  }

  if (!isPersonaId(value.personaId)) {
    throw new ValidationError("Login requires a valid personaId.");
  }

  const pin = normalizePin(value.pin);
  if (!pin) {
    throw new ValidationError("Login requires a valid PIN.");
  }

  return {
    personaId: value.personaId,
    pin
  };
}

export function parseZymixMessageFilters(searchParams: URLSearchParams): ListZymixMessageFilters {
  const threadId = parseThreadId(searchParams.get("threadId"));

  if (!threadId) {
    throw new ValidationError("threadId is required.");
  }

  return { threadId };
}

export function parseThreadIdList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const raw of value.split(",")) {
    const threadId = parseThreadId(raw);
    if (threadId && !seen.has(threadId)) {
      seen.add(threadId);
      ids.push(threadId);
    }

    if (ids.length >= 50) {
      break;
    }
  }

  return ids;
}

export function parseCreateZymixMessageInput(value: unknown): CreateZymixMessageInput {
  if (!isRecord(value)) {
    throw new ValidationError("Zymix message payload must be a JSON object.");
  }

  const threadId = parseThreadId(value.threadId);
  if (!threadId) {
    throw new ValidationError("Zymix message requires a valid threadId.");
  }

  const text = normalizeMessageText(value.text);
  if (!text) {
    throw new ValidationError("Zymix message requires non-empty text.");
  }

  return { threadId, text };
}

export function parsePlannerSessionFilters(searchParams: URLSearchParams): PlannerSessionFilters {
  const threadId = parseThreadId(searchParams.get("threadId"));

  if (!threadId) {
    throw new ValidationError("threadId is required.");
  }

  return { threadId };
}

export function parseSubmitPlannerCriteriaInput(value: unknown): SubmitPlannerCriteriaInput {
  if (!isRecord(value)) {
    throw new ValidationError("Planner criteria payload must be a JSON object.");
  }

  const threadId = parseThreadId(value.threadId);
  if (!threadId) {
    throw new ValidationError("Planner criteria requires a valid threadId.");
  }

  const availability = normalizeFreeText(value.availability, 160);
  if (!availability) {
    throw new ValidationError("Planner criteria requires availability.");
  }

  const availabilityMode = normalizePlannerAvailabilityMode(value.availabilityMode, availability);
  const budgetOption = normalizeBudgetOption(value.budgetOption);
  const budgetMode = normalizePlannerBudgetMode(value.budgetMode);
  const budgetAmount = normalizePlannerBudgetAmount(value.budgetAmount ?? value.budgetSliderValue);
  const budgetText = normalizeFreeText(value.budgetText, 80);

  const normalizedBudgetMode =
    budgetMode === "slider" || (budgetMode === "text" && budgetAmount !== undefined && budgetOption === undefined && budgetText === undefined)
      ? "slider"
      : budgetMode;

  if (normalizedBudgetMode === "slider" && budgetAmount === undefined) {
    throw new ValidationError("Planner criteria requires budgetAmount.");
  }
  if (normalizedBudgetMode !== "slider" && budgetOption === undefined && budgetText === undefined) {
    throw new ValidationError("Planner criteria requires budgetAmount or budgetOption.");
  }

  const vetoText = normalizeFreeText(value.vetoText, 320);
  const vetoes = normalizePlannerVetoesFromSource(vetoText, value.vetoes);
  return {
    threadId,
    availabilityMode,
    availability,
    budgetMode: normalizedBudgetMode,
    budgetAmount: budgetAmount ?? 0,
    budgetOption,
    budgetText,
    vetoText,
    vetoes
  };
}

export function parseSubmitPlannerVoteInput(value: unknown): SubmitPlannerVoteInput {
  if (!isRecord(value)) {
    throw new ValidationError("Planner vote payload must be a JSON object.");
  }

  const threadId = parseThreadId(value.threadId);
  if (!threadId) {
    throw new ValidationError("Planner vote requires a valid threadId.");
  }

  if (!Array.isArray(value.bucketItemIds)) {
    throw new ValidationError("Planner vote requires bucketItemIds.");
  }

  const bucketItemIds = uniqueBucketItemIds(value.bucketItemIds);
  if (bucketItemIds.length === 0 || bucketItemIds.length > 3) {
    throw new ValidationError("Planner vote requires 1 to 3 bucketItemIds.");
  }

  return { threadId, bucketItemIds };
}

export function parseCancelPlannerSessionInput(value: unknown): CancelPlannerSessionInput {
  if (!isRecord(value)) {
    throw new ValidationError("Planner cancel payload must be a JSON object.");
  }

  const threadId = parseThreadId(value.threadId);
  if (!threadId) {
    throw new ValidationError("Planner cancel requires a valid threadId.");
  }

  return { threadId };
}

export function normalizePriceEstimate(value: unknown): PriceEstimateTier {
  if (typeof value !== "string") {
    return "$$";
  }

  const trimmed = value.trim();
  if (trimmed === "$" || trimmed === "$$" || trimmed === "$$$") {
    return trimmed;
  }

  const currencyRunLengths = Array.from(trimmed.matchAll(/[$£€]+/g), (match) => match[0].length);
  const longestCurrencyRun = currencyRunLengths.length > 0 ? Math.max(...currencyRunLengths) : 0;
  if (longestCurrencyRun >= 3) {
    return "$$$";
  }
  if (longestCurrencyRun === 2) {
    return "$$";
  }
  if (longestCurrencyRun === 1) {
    return "$";
  }

  if (/\b(free|cheap|budget|affordable|low[- ]cost)\b/i.test(trimmed)) {
    return "$";
  }

  if (/\b(luxury|expensive|upscale|premium|fine dining)\b/i.test(trimmed)) {
    return "$$$";
  }

  return "$$";
}

export function normalizeEnrichmentStatus(value: unknown): BucketItemEnrichmentStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return bucketItemEnrichmentStatuses.has(value as BucketItemEnrichmentStatus)
    ? (value as BucketItemEnrichmentStatus)
    : undefined;
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Bucket item requires ${fieldName}.`);
  }

  return value.trim();
}

function normalizePin(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value.toString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const pin = value.trim();
  return pin.length > 0 ? pin : null;
}

function optionalHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeHttpUrlArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const links: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const link = optionalHttpUrl(entry);
    if (!link || seen.has(link)) {
      continue;
    }

    seen.add(link);
    links.push(link);
    if (links.length >= 8) {
      break;
    }
  }

  return links.length > 0 ? links : undefined;
}

function parseThreadId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const threadId = value.trim();
  if (threadId.length === 0 || threadId.length > 120) {
    return null;
  }

  return threadId;
}

function normalizeMessageText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  if (text.length === 0 || text.length > 1000) {
    return null;
  }

  return text;
}

function normalizeFreeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim().replace(/\s+/g, " ");
  if (text.length === 0) {
    return undefined;
  }

  return text.slice(0, maxLength);
}

function normalizeBudgetOption(value: unknown): string | undefined {
  return normalizeFreeText(value, 40);
}

function normalizePlannerBudgetMode(value: unknown): "slider" | "text" {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "slider") {
      return "slider";
    }
  }

  return "text";
}

function normalizePlannerBudgetAmount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizePlannerBudget(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return normalizePlannerBudget(parsed);
    }
  }

  return undefined;
}

function normalizePlannerBudget(value: number): number {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded) || rounded < 0) {
    return 0;
  }

  if (rounded <= 40) {
    return rounded;
  }

  return 60;
}

function normalizePlannerAvailabilityMode(value: unknown, availability: string): "Whenever" | "Custom" {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "whenever") {
      return "Whenever";
    }
    if (normalized === "custom") {
      return "Custom";
    }
  }

  return availability.toLowerCase() === "whenever" || availability.toLowerCase().includes("whenever") ? "Whenever" : "Custom";
}

function normalizePlannerVetoesFromSource(vetoText: string | undefined, rawVetoes: unknown): string[] {
  const vetoes: string[] = [];
  const seen = new Set<string>();

  if (vetoText) {
    for (const veto of vetoText.split(/[,\n;]+/)) {
      const normalized = normalizeFreeText(veto, 60);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      vetoes.push(normalized);
      if (vetoes.length >= 8) {
        return vetoes;
      }
    }
  }

  for (const veto of normalizePlannerVetoes(rawVetoes)) {
    const key = veto.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    vetoes.push(veto);
    if (vetoes.length >= 8) {
      break;
    }
  }

  return vetoes;
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

function normalizePlannerVetoes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const vetoes: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const veto = normalizeFreeText(entry, 60);
    if (!veto) {
      continue;
    }

    const key = veto.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    vetoes.push(veto);
    if (vetoes.length >= 8) {
      break;
    }
  }

  return vetoes;
}

function uniqueBucketItemIds(value: unknown[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const id = entry.trim();
    if (id.length === 0 || id.length > 120 || seen.has(id)) {
      continue;
    }

    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export function normalizeStringArray(value: unknown): string[] {
  return normalizeTags(value);
}

export function isPlannerParticipantId(value: unknown): value is PlannerParticipantId {
  return value === "jeff" || value === "praya" || value === "tana";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
