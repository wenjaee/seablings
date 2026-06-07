import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  BucketCategory,
  BucketItem,
  BucketItemDateType,
  BucketItemStatus,
  CapturePayload,
  ChatMessage,
  IngestionTask,
  IngestionTaskStatus,
  Persona,
  PlanningCriteria,
  Recommendation,
  SourcePlatform,
  ZymixMessage
} from "@/lib/domain";
import {
  personas,
  seededBucketItems,
  seededCriteria,
  seededMessages,
  seededRecommendations,
  seededZymixMessages
} from "@/lib/fixtures";
import type {
  CreateZymixMessageInput,
  ListBucketItemFilters,
  ListCaptureFilters,
  ListZymixMessageFilters,
  ManualBucketItemInput
} from "@/lib/server/validation";
import { normalizeEnrichmentStatus, normalizePriceEstimate, normalizeStringArray } from "@/lib/server/validation";

type StoreMode = "demo" | "supabase";

type BackendStore = {
  mode: StoreMode;
  listCaptures(filters?: ListCaptureFilters): Promise<IngestionTask[]>;
  createCaptureTask(payload: CapturePayload): Promise<IngestionTask>;
  updateCaptureTaskStatus(id: string, status: IngestionTaskStatus): Promise<IngestionTask | null>;
  listBucketItems(filters?: ListBucketItemFilters): Promise<BucketItem[]>;
  createBucketItem(input: ManualBucketItemInput): Promise<BucketItem>;
  saveBucketItemEmbedding(input: BucketItemEmbeddingInput): Promise<void>;
  updateBucketItemStatus(id: string, status: BucketItemStatus): Promise<BucketItem | null>;
  listZymixMessages(filters: ListZymixMessageFilters): Promise<ZymixMessage[]>;
  createZymixMessage(userId: ZymixMessage["userId"], input: CreateZymixMessageInput): Promise<ZymixMessage>;
  getLatestZymixMessages(threadIds: string[]): Promise<Record<string, ZymixMessage | null>>;
};

type BucketItemEmbeddingInput = {
  bucketItemId: string;
  values: number[];
  text: string;
  model: string;
  dimensions: number;
  contentHash: string;
};

type BucketItemEmbeddingRecord = BucketItemEmbeddingInput & {
  createdAt: string;
  updatedAt: string;
};

type DemoState = {
  personas: Persona[];
  criteria: PlanningCriteria[];
  recommendations: Recommendation[];
  messages: ChatMessage[];
  zymixMessages: ZymixMessage[];
  tasks: IngestionTask[];
  bucketItems: BucketItem[];
  bucketItemEmbeddings: BucketItemEmbeddingRecord[];
};

type IngestionTaskRow = {
  id: string;
  user_id: string;
  status: string;
  source_type: string;
  source_url: string | null;
  text: string | null;
  screenshot_name: string | null;
  created_at: string;
  updated_at: string;
};

type BucketItemRow = {
  id: string;
  user_id: string;
  status: string;
  date_type: string;
  title: string;
  category: string;
  description: string;
  why_interesting: string;
  location_name: string;
  neighborhood: string;
  address: string | null;
  postal_code: string | null;
  price_estimate: string;
  estimated_cost: number;
  opening_hours: string | null;
  website_url: string | null;
  source_url: string | null;
  source_type: string;
  enrichment_provider: string | null;
  enrichment_status: string | null;
  enrichment_source_links: string[] | null;
  enrichment_confidence_note: string | null;
  tags: string[] | null;
  confidence: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

type PersonaRow = {
  id: string;
  name: string;
  color: string;
  postal_code: string;
  default_budget_max: number;
};

type PlanningCriteriaRow = {
  user_id: string;
  budget_max: number;
  available_times: string[] | null;
  postal_code: string;
  vetoes: string[] | null;
};

type MessageRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
};

type RecommendationRow = {
  bucket_item_id: string;
  score: number;
  reasons: string[] | null;
  warnings: string[] | null;
};

type ZymixMessageRow = {
  id: string;
  thread_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

declare global {
  var __seablingsDemoState: DemoState | undefined;
  var __seablingsSupabaseSeedPromise: Promise<void> | undefined;
}

export function getBackendStore(): BackendStore {
  if (isSupabaseConfigured()) {
    return createSupabaseStore();
  }

  return createDemoStore();
}

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function createDemoStore(): BackendStore {
  return {
    mode: "demo",
    async listCaptures(filters) {
      const state = getDemoState();
      const tasks = state.tasks.filter((task) => {
        if (filters?.userId && task.userId !== filters.userId) {
          return false;
        }

        if (filters?.status && task.status !== filters.status) {
          return false;
        }

        return true;
      });

      return sortNewest(tasks);
    },
    async createCaptureTask(payload) {
      const state = getDemoState();
      const timestamp = nowIso();
      const task: IngestionTask = {
        id: createId("task"),
        userId: payload.userId,
        status: "queued",
        sourceType: payload.sourceType,
        sourceUrl: payload.sourceUrl,
        text: payload.text,
        screenshotName: payload.screenshotName,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      state.tasks.unshift(task);
      return task;
    },
    async updateCaptureTaskStatus(id, status) {
      const state = getDemoState();
      const task = state.tasks.find((candidate) => candidate.id === id);

      if (!task) {
        return null;
      }

      task.status = status;
      task.updatedAt = nowIso();
      return { ...task };
    },
    async listBucketItems(filters) {
      const state = getDemoState();
      const items = state.bucketItems.filter((item) => {
        if (filters?.userId && item.userId !== filters.userId) {
          return false;
        }

        if (filters?.status && item.status !== filters.status) {
          return false;
        }

        return true;
      });

      return sortNewest(items);
    },
    async createBucketItem(input) {
      const state = getDemoState();
      const timestamp = nowIso();
      const item = createBucketItemDomainModel(input, timestamp);
      state.bucketItems.unshift(item);
      return item;
    },
    async saveBucketItemEmbedding(input) {
      const state = getDemoState();
      const timestamp = nowIso();
      const existing = state.bucketItemEmbeddings.find((embedding) => embedding.bucketItemId === input.bucketItemId);

      if (existing) {
        existing.values = input.values;
        existing.text = input.text;
        existing.model = input.model;
        existing.dimensions = input.dimensions;
        existing.contentHash = input.contentHash;
        existing.updatedAt = timestamp;
        return;
      }

      state.bucketItemEmbeddings.push({
        ...input,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    },
    async updateBucketItemStatus(id, status) {
      const state = getDemoState();
      const item = state.bucketItems.find((candidate) => candidate.id === id);

      if (!item) {
        return null;
      }

      item.status = status;
      item.updatedAt = nowIso();
      return { ...item };
    },
    async listZymixMessages(filters) {
      const state = getDemoState();

      return sortByCreatedAtAscending(
        state.zymixMessages.filter((message) => message.threadId === filters.threadId)
      );
    },
    async createZymixMessage(userId, input) {
      const state = getDemoState();
      const message: ZymixMessage = {
        id: createId("zymix"),
        threadId: input.threadId,
        userId,
        text: input.text,
        createdAt: nowIso()
      };

      state.zymixMessages.push(message);
      return message;
    },
    async getLatestZymixMessages(threadIds) {
      const state = getDemoState();
      const result: Record<string, ZymixMessage | null> = {};
      for (const threadId of threadIds) {
        const messages = sortByCreatedAtAscending(
          state.zymixMessages.filter((message) => message.threadId === threadId)
        );
        result[threadId] = messages.length > 0 ? messages[messages.length - 1] : null;
      }
      return result;
    }
  };
}

function createSupabaseStore(): BackendStore {
  const client = getSupabaseClient();

  return {
    mode: "supabase",
    async listCaptures(filters) {
      await ensureSupabaseSeeded(client);

      let query = client.from("ingestion_tasks").select("*").order("created_at", { ascending: false });
      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to list captures: ${error.message}`);
      }

      return (data ?? []).map(mapTaskRowToDomain);
    },
    async createCaptureTask(payload) {
      await ensureSupabaseSeeded(client);

      const timestamp = nowIso();
      const task: IngestionTask = {
        id: createId("task"),
        userId: payload.userId,
        status: "queued",
        sourceType: payload.sourceType,
        sourceUrl: payload.sourceUrl,
        text: payload.text,
        screenshotName: payload.screenshotName,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const { data, error } = await client
        .from("ingestion_tasks")
        .insert(mapTaskDomainToRow(task))
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create capture task: ${error.message}`);
      }

      return mapTaskRowToDomain(data as IngestionTaskRow);
    },
    async updateCaptureTaskStatus(id, status) {
      await ensureSupabaseSeeded(client);

      const timestamp = nowIso();
      const { data, error } = await client
        .from("ingestion_tasks")
        .update({ status, updated_at: timestamp })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update capture task status: ${error.message}`);
      }

      return data ? mapTaskRowToDomain(data as IngestionTaskRow) : null;
    },
    async listBucketItems(filters) {
      await ensureSupabaseSeeded(client);

      let query = client.from("bucket_items").select("*").order("updated_at", { ascending: false });
      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to list bucket items: ${error.message}`);
      }

      return (data ?? []).map(mapBucketItemRowToDomain);
    },
    async createBucketItem(input) {
      await ensureSupabaseSeeded(client);

      const timestamp = nowIso();
      const item = createBucketItemDomainModel(input, timestamp);

      const { data, error } = await client.from("bucket_items").insert(mapBucketItemDomainToRow(item)).select().single();
      if (error) {
        throw new Error(`Failed to create bucket item: ${error.message}`);
      }

      return mapBucketItemRowToDomain(data as BucketItemRow);
    },
    async saveBucketItemEmbedding(input) {
      await ensureSupabaseSeeded(client);

      const timestamp = nowIso();
      const { error } = await client.from("bucket_item_embeddings").upsert(
        {
          bucket_item_id: input.bucketItemId,
          embedding: formatVector(input.values),
          embedding_text: input.text,
          model: input.model,
          dimensions: input.dimensions,
          content_hash: input.contentHash,
          updated_at: timestamp
        },
        { onConflict: "bucket_item_id" }
      );

      if (error) {
        throw new Error(`Failed to save bucket item embedding: ${error.message}`);
      }
    },
    async updateBucketItemStatus(id, status) {
      await ensureSupabaseSeeded(client);

      const timestamp = nowIso();
      const { data, error } = await client
        .from("bucket_items")
        .update({ status, updated_at: timestamp })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update bucket item status: ${error.message}`);
      }

      return data ? mapBucketItemRowToDomain(data as BucketItemRow) : null;
    },
    async listZymixMessages(filters) {
      await ensureSupabaseSeeded(client);

      const { data, error } = await client
        .from("zymix_messages")
        .select("*")
        .eq("thread_id", filters.threadId)
        .order("created_at", { ascending: true });

      if (error) {
        if (isMissingSupabaseTableError(error, "zymix_messages")) {
          return createDemoStore().listZymixMessages(filters);
        }

        throw new Error(`Failed to list Zymix messages: ${error.message}`);
      }

      return (data ?? []).map(mapZymixMessageRowToDomain);
    },
    async createZymixMessage(userId, input) {
      await ensureSupabaseSeeded(client);

      const message: ZymixMessage = {
        id: createId("zymix"),
        threadId: input.threadId,
        userId,
        text: input.text,
        createdAt: nowIso()
      };

      const { data, error } = await client
        .from("zymix_messages")
        .insert(mapZymixMessageDomainToRow(message))
        .select()
        .single();

      if (error) {
        if (isMissingSupabaseTableError(error, "zymix_messages")) {
          return createDemoStore().createZymixMessage(userId, input);
        }

        throw new Error(`Failed to create Zymix message: ${error.message}`);
      }

      return mapZymixMessageRowToDomain(data as ZymixMessageRow);
    },
    async getLatestZymixMessages(threadIds) {
      await ensureSupabaseSeeded(client);

      const result: Record<string, ZymixMessage | null> = {};
      for (const threadId of threadIds) {
        result[threadId] = null;
      }
      if (threadIds.length === 0) {
        return result;
      }

      const { data, error } = await client
        .from("zymix_messages")
        .select("*")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false });

      if (error) {
        if (isMissingSupabaseTableError(error, "zymix_messages")) {
          return createDemoStore().getLatestZymixMessages(threadIds);
        }

        throw new Error(`Failed to load latest Zymix messages: ${error.message}`);
      }

      for (const row of (data ?? []) as ZymixMessageRow[]) {
        if (result[row.thread_id] === null) {
          result[row.thread_id] = mapZymixMessageRowToDomain(row);
        }
      }

      return result;
    }
  };
}

function getDemoState(): DemoState {
  if (!globalThis.__seablingsDemoState) {
    globalThis.__seablingsDemoState = {
      personas: structuredClone(personas),
      criteria: structuredClone(seededCriteria),
      recommendations: structuredClone(seededRecommendations),
      messages: structuredClone(seededMessages),
      zymixMessages: structuredClone(seededZymixMessages),
      tasks: [],
      bucketItems: structuredClone(seededBucketItems),
      bucketItemEmbeddings: []
    };
  }

  return globalThis.__seablingsDemoState;
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Supabase env vars are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

async function ensureSupabaseSeeded(client: SupabaseClient): Promise<void> {
  if (globalThis.__seablingsSupabaseSeedPromise) {
    return globalThis.__seablingsSupabaseSeedPromise;
  }

  globalThis.__seablingsSupabaseSeedPromise = (async () => {
    const [
      { count: personaCount, error: personasError },
      { count: criteriaCount, error: criteriaError }
    ] = await Promise.all([
      client.from("personas").select("*", { head: true, count: "exact" }),
      client.from("planner_criteria").select("*", { head: true, count: "exact" })
    ]);

    if (personasError) {
      throw new Error(`Failed to inspect Supabase persona seed state: ${personasError.message}`);
    }

    if (criteriaError) {
      throw new Error(`Failed to inspect Supabase criteria seed state: ${criteriaError.message}`);
    }

    if ((personaCount ?? 0) >= personas.length && (criteriaCount ?? 0) >= seededCriteria.length) {
      return;
    }

    await runSupabaseSeed(client);
  })().catch((error) => {
    globalThis.__seablingsSupabaseSeedPromise = undefined;
    throw error;
  });

  return globalThis.__seablingsSupabaseSeedPromise;
}

async function runSupabaseSeed(client: SupabaseClient): Promise<void> {
  const { error: personasError } = await client.from("personas").upsert(
    personas.map((persona) => ({
      id: persona.id,
      name: persona.name,
      color: persona.color,
      postal_code: persona.postalCode,
      default_budget_max: persona.defaultBudgetMax
    }) satisfies PersonaRow),
    { onConflict: "id" }
  );
  if (personasError) {
    throw new Error(`Failed to seed personas: ${personasError.message}`);
  }

  const { error: criteriaError } = await client.from("planner_criteria").upsert(
    seededCriteria.map((criteria) => ({
      user_id: criteria.userId,
      budget_max: criteria.budgetMax,
      available_times: criteria.availableTimes,
      postal_code: criteria.postalCode,
      vetoes: criteria.vetoes
    }) satisfies PlanningCriteriaRow),
    { onConflict: "user_id" }
  );
  if (criteriaError) {
    throw new Error(`Failed to seed planner criteria: ${criteriaError.message}`);
  }

  const { error: messagesError } = await client.from("messages").upsert(
    seededMessages.map((message) => ({
      id: message.id,
      user_id: message.userId,
      text: message.text,
      created_at: message.createdAt
    }) satisfies MessageRow),
    { onConflict: "id" }
  );
  if (messagesError) {
    throw new Error(`Failed to seed messages: ${messagesError.message}`);
  }

  const { error: zymixMessagesError } = await client.from("zymix_messages").upsert(
    seededZymixMessages.map((message) => ({
      id: message.id,
      thread_id: message.threadId,
      user_id: message.userId,
      text: message.text,
      created_at: message.createdAt
    }) satisfies ZymixMessageRow),
    { onConflict: "id" }
  );
  if (zymixMessagesError) {
    if (!isMissingSupabaseTableError(zymixMessagesError, "zymix_messages")) {
      throw new Error(`Failed to seed Zymix messages: ${zymixMessagesError.message}`);
    }
  }

  const { error: bucketItemsError } = await client.from("bucket_items").upsert(
    seededBucketItems.map((item) => mapBucketItemDomainToRow(item)),
    { onConflict: "id" }
  );
  if (bucketItemsError) {
    throw new Error(`Failed to seed bucket items: ${bucketItemsError.message}`);
  }

  const { error: recommendationsError } = await client.from("recommendations").upsert(
    seededRecommendations.map((recommendation) => ({
      bucket_item_id: recommendation.bucketItemId,
      score: recommendation.score,
      reasons: recommendation.reasons,
      warnings: recommendation.warnings
    }) satisfies RecommendationRow),
    { onConflict: "bucket_item_id" }
  );
  if (recommendationsError) {
    throw new Error(`Failed to seed recommendations: ${recommendationsError.message}`);
  }
}

function createBucketItemDomainModel(input: ManualBucketItemInput, timestamp: string): BucketItem {
  return {
    id: createId("item"),
    userId: input.userId,
    status: input.status ?? "candidate",
    dateType: input.dateType ?? "anytime",
    title: input.title,
    category: input.category,
    description: input.description,
    whyInteresting: input.whyInteresting,
    locationName: input.locationName,
    neighborhood: input.neighborhood,
    address: input.address,
    postalCode: input.postalCode,
    priceEstimate: normalizePriceEstimate(input.priceEstimate),
    estimatedCost: normalizeEstimatedCost(input.estimatedCost),
    openingHours: input.openingHours,
    websiteUrl: input.websiteUrl,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType ?? "manual",
    enrichmentProvider: normalizeOptionalText(input.enrichmentProvider),
    enrichmentStatus: normalizeEnrichmentStatus(input.enrichmentStatus),
    enrichmentSourceLinks: normalizeStringArray(input.enrichmentSourceLinks),
    enrichmentConfidenceNote: normalizeOptionalText(input.enrichmentConfidenceNote),
    tags: normalizeStringArray(input.tags),
    confidence: normalizeConfidence(input.confidence),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function mapTaskDomainToRow(task: IngestionTask): IngestionTaskRow {
  return {
    id: task.id,
    user_id: task.userId,
    status: task.status,
    source_type: task.sourceType,
    source_url: task.sourceUrl ?? null,
    text: task.text ?? null,
    screenshot_name: task.screenshotName ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt
  };
}

function mapTaskRowToDomain(row: IngestionTaskRow): IngestionTask {
  return {
    id: row.id,
    userId: row.user_id as IngestionTask["userId"],
    status: row.status as IngestionTaskStatus,
    sourceType: row.source_type as SourcePlatform,
    sourceUrl: row.source_url ?? undefined,
    text: row.text ?? undefined,
    screenshotName: row.screenshot_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBucketItemDomainToRow(item: BucketItem): BucketItemRow {
  return {
    id: item.id,
    user_id: item.userId,
    status: item.status,
    date_type: item.dateType,
    title: item.title,
    category: item.category,
    description: item.description,
    why_interesting: item.whyInteresting,
    location_name: item.locationName,
    neighborhood: item.neighborhood,
    address: item.address ?? null,
    postal_code: item.postalCode ?? null,
    price_estimate: item.priceEstimate,
    estimated_cost: item.estimatedCost,
    opening_hours: item.openingHours ?? null,
    website_url: item.websiteUrl ?? null,
    source_url: item.sourceUrl ?? null,
    source_type: item.sourceType,
    enrichment_provider: item.enrichmentProvider ?? null,
    enrichment_status: item.enrichmentStatus ?? null,
    enrichment_source_links: item.enrichmentSourceLinks ?? [],
    enrichment_confidence_note: item.enrichmentConfidenceNote ?? null,
    tags: item.tags,
    confidence: item.confidence,
    starts_at: item.startsAt ?? null,
    ends_at: item.endsAt ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt
  };
}

function mapBucketItemRowToDomain(row: BucketItemRow): BucketItem {
  return {
    id: row.id,
    userId: row.user_id as BucketItem["userId"],
    status: row.status as BucketItemStatus,
    dateType: row.date_type as BucketItemDateType,
    title: row.title,
    category: row.category as BucketCategory,
    description: row.description,
    whyInteresting: row.why_interesting,
    locationName: row.location_name,
    neighborhood: row.neighborhood,
    address: row.address ?? undefined,
    postalCode: row.postal_code ?? undefined,
    priceEstimate: normalizePriceEstimate(row.price_estimate),
    estimatedCost: row.estimated_cost,
    openingHours: row.opening_hours ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sourceType: row.source_type as SourcePlatform,
    enrichmentProvider: normalizeOptionalText(row.enrichment_provider),
    enrichmentStatus: normalizeEnrichmentStatus(row.enrichment_status),
    enrichmentSourceLinks: normalizeStringArray(row.enrichment_source_links),
    enrichmentConfidenceNote: normalizeOptionalText(row.enrichment_confidence_note),
    tags: normalizeStringArray(row.tags),
    confidence: row.confidence,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapZymixMessageDomainToRow(message: ZymixMessage): ZymixMessageRow {
  return {
    id: message.id,
    thread_id: message.threadId,
    user_id: message.userId,
    text: message.text,
    created_at: message.createdAt
  };
}

function mapZymixMessageRowToDomain(row: ZymixMessageRow): ZymixMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id as ZymixMessage["userId"],
    text: row.text,
    createdAt: row.created_at
  };
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sortNewest<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function sortByCreatedAtAscending<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function formatVector(values: number[]): string {
  return `[${values.map((value) => (Number.isFinite(value) ? value : 0)).join(",")}]`;
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

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isMissingSupabaseTableError(error: { code?: string; message?: string } | null, table: string): boolean {
  if (!error) {
    return false;
  }

  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes(`'public.${table}'`) ||
    message.includes(`relation "${table}" does not exist`)
  );
}

export type { BackendStore, BucketItemEmbeddingInput, StoreMode };
