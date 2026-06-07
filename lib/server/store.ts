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
  PlannerCriteriaAnswer,
  PlannerAggregateCriteria,
  PlannerParticipantId,
  PlannerRecommendation,
  PlannerFinalPlan,
  PlannerSession,
  PlannerSessionStatus,
  PlannerVote,
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
import { normalizePlaceCategory } from "@/lib/server/place-categories";
import type {
  CreateZymixMessageInput,
  ListBucketItemFilters,
  ListCaptureFilters,
  PlannerSessionFilters,
  ListZymixMessageFilters,
  ManualBucketItemInput,
  SubmitPlannerCriteriaInput,
  SubmitPlannerVoteInput
} from "@/lib/server/validation";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  normalizeEnrichmentStatus,
  normalizePriceEstimate,
  normalizeStringArray
} from "@/lib/server/validation";
import { buildPlannerAggregateCriteria } from "@/lib/server/providers";

type StoreMode = "demo" | "supabase";

type BackendStore = {
  mode: StoreMode;
  listCaptures(filters?: ListCaptureFilters): Promise<IngestionTask[]>;
  createCaptureTask(payload: CapturePayload): Promise<IngestionTask>;
  updateCaptureTaskStatus(id: string, status: IngestionTaskStatus): Promise<IngestionTask | null>;
  listBucketItems(filters?: ListBucketItemFilters): Promise<BucketItem[]>;
  createBucketItem(input: ManualBucketItemInput): Promise<BucketItem>;
  saveBucketItemEmbedding(input: BucketItemEmbeddingInput): Promise<void>;
  getBucketItemById(id: string): Promise<BucketItem | null>;
  updateBucketItemStatus(id: string, status: BucketItemStatus): Promise<BucketItem | null>;
  updateBucketItemPhoto(id: string, input: BucketItemPhotoInput): Promise<BucketItem | null>;
  listZymixMessages(filters: ListZymixMessageFilters): Promise<ZymixMessage[]>;
  createZymixMessage(userId: ZymixMessage["userId"], input: CreateZymixMessageInput): Promise<ZymixMessage>;
  getLatestZymixMessages(threadIds: string[]): Promise<Record<string, ZymixMessage | null>>;
  getLatestPlannerSession(threadId: PlannerSessionFilters["threadId"]): Promise<PlannerSession | null>;
  createOrResumePlannerSession(threadId: string, initiatorUserId: PlannerSession["initiatorUserId"]): Promise<PlannerSession>;
  cancelPlannerSession(threadId: string, userId: PlannerParticipantId): Promise<PlannerSession>;
  deleteLatestPlannerSession(threadId: string, userId: PlannerParticipantId): Promise<void>;
  submitPlannerCriteria(
    threadId: string,
    userId: PlannerParticipantId,
    input: SubmitPlannerCriteriaInput
  ): Promise<PlannerSession>;
  submitPlannerVote(threadId: string, userId: PlannerParticipantId, bucketItemIds: string[]): Promise<PlannerSession>;
};

type BucketItemEmbeddingInput = {
  bucketItemId: string;
  values: number[];
  text: string;
  model: string;
  dimensions: number;
  contentHash: string;
};

type BucketItemPhotoInput = {
  photoUrl?: string;
  photoSourceLinks?: string[];
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
  plannerSessions: PlannerSession[];
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
  photo_url: string | null;
  photo_source_links: string[] | null;
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

type PlannerSessionRow = {
  id: string;
  thread_id: string;
  initiator_user_id: string;
  status: string;
  state: PlannerSession;
  created_at: string;
  updated_at: string;
};

declare global {
  var __seablingsDemoState: DemoState | undefined;
  var __seablingsSupabaseSeedPromise: Promise<void> | undefined;
}

const plannerParticipants: PlannerParticipantId[] = ["jeff", "praya", "tana"];
const plannerParticipantSet = new Set<PlannerParticipantId>(plannerParticipants);
let plannerSessionsTableMissing = false;
const activePlannerSessionStatuses = new Set<PlannerSessionStatus>(["collecting", "voting"]);

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
    async getBucketItemById(id) {
      const state = getDemoState();
      const item = state.bucketItems.find((candidate) => candidate.id === id);

      return item ? { ...item } : null;
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
    async updateBucketItemPhoto(id, input) {
      const state = getDemoState();
      const item = state.bucketItems.find((candidate) => candidate.id === id);

      if (!item) {
        return null;
      }

      item.photoUrl = normalizeOptionalText(input.photoUrl);
      item.photoSourceLinks = normalizeStringArray(input.photoSourceLinks);
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
    },
    async getLatestPlannerSession(threadId) {
      const state = getDemoState();
      return hydratePlannerSessionPhotos(getLatestPlannerSessionFromCollection(state.plannerSessions, threadId), state.bucketItems);
    },
    async createOrResumePlannerSession(threadId, initiatorUserId) {
      const state = getDemoState();
      const existing = getLatestPlannerSessionFromCollection(state.plannerSessions, threadId);
      if (existing && isActivePlannerSessionStatus(existing.status)) {
        return clonePlannerSession(existing);
      }

      const session = createPlannerSession(threadId, initiatorUserId);
      state.plannerSessions.push(session);
      return clonePlannerSession(session);
    },
    async cancelPlannerSession(threadId, userId) {
      const state = getDemoState();
      assertPlannerParticipant(userId);
      const session = findLatestMutablePlannerSession(state.plannerSessions, threadId);

      if (!isActivePlannerSessionStatus(session.status)) {
        throw new ConflictError(`Planner session is not active.`);
      }

      markPlannerSessionCanceled(session, userId);
      return clonePlannerSession(session);
    },
    async deleteLatestPlannerSession(threadId, userId) {
      const state = getDemoState();
      assertPlannerParticipant(userId);
      const session = findLatestMutablePlannerSession(state.plannerSessions, threadId);
      state.plannerSessions = state.plannerSessions.filter((candidate) => candidate.id !== session.id);
    },
    async submitPlannerCriteria(threadId, userId, input) {
      const state = getDemoState();
      const session = findLatestMutablePlannerSession(state.plannerSessions, threadId);
      assertPlannerParticipant(userId);

      if (session.status !== "collecting") {
        throw new ConflictError("Planner session is not collecting criteria.");
      }

      session.criteriaByUserId[userId] = createPlannerCriteriaAnswer(userId, input);
      await recalculatePlannerSession(session, state.bucketItems);
      session.updatedAt = nowIso();
      return clonePlannerSession(session);
    },
    async submitPlannerVote(threadId, userId, bucketItemIds) {
      const state = getDemoState();
      const session = findLatestMutablePlannerSession(state.plannerSessions, threadId);
      assertPlannerParticipant(userId);

      if (session.status !== "voting") {
        throw new ConflictError("Planner session is not ready for votes.");
      }

      assertValidPlannerVote(session, bucketItemIds);
      session.votesByUserId[userId] = {
        userId,
        bucketItemIds: [...bucketItemIds],
        submittedAt: nowIso()
      };
      finalizePlannerSessionIfReady(session);
      session.updatedAt = nowIso();
      return clonePlannerSession(session);
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
    async getBucketItemById(id) {
      await ensureSupabaseSeeded(client);

      const { data, error } = await client.from("bucket_items").select("*").eq("id", id).maybeSingle();
      if (error) {
        throw new Error(`Failed to load bucket item: ${error.message}`);
      }

      return data ? mapBucketItemRowToDomain(data as BucketItemRow) : null;
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
    async updateBucketItemPhoto(id, input) {
      await ensureSupabaseSeeded(client);

      const timestamp = nowIso();
      const { data, error } = await client
        .from("bucket_items")
        .update({
          photo_url: normalizeOptionalText(input.photoUrl) ?? null,
          photo_source_links: normalizeStringArray(input.photoSourceLinks),
          updated_at: timestamp
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update bucket item photo: ${error.message}`);
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
    },
    async getLatestPlannerSession(threadId) {
      await ensureSupabaseSeeded(client);
      const session = await loadLatestPlannerSessionOrNull(client, threadId);
      if (!session) {
        return null;
      }

      const bucketItems = await listSavedPlannerBucketItems(client);
      return hydratePlannerSessionPhotos(session, bucketItems);
    },
    async createOrResumePlannerSession(threadId, initiatorUserId) {
      await ensureSupabaseSeeded(client);

      const existing = await loadLatestPlannerSessionOrNull(client, threadId);
      if (existing && isActivePlannerSessionStatus(existing.status)) {
        return existing;
      }

      const session = createPlannerSession(threadId, initiatorUserId);
      const { data, error } = await client
        .from("planner_sessions")
        .insert(mapPlannerSessionDomainToRow(session))
        .select("*")
        .single();

      if (error) {
        if (isMissingSupabaseTableError(error, "planner_sessions")) {
          return createDemoStore().createOrResumePlannerSession(threadId, initiatorUserId);
        }

        throw new Error(`Failed to create planner session: ${error.message}`);
      }

      return mapPlannerSessionRowToDomain(data as PlannerSessionRow);
    },
    async cancelPlannerSession(threadId, userId) {
      await ensureSupabaseSeeded(client);
      assertPlannerParticipant(userId);

      const session = await loadLatestPlannerSessionOrNull(client, threadId);
      if (!session) {
        throw new NotFoundError("No planner session found for this thread.");
      }
      if (!isActivePlannerSessionStatus(session.status)) {
        throw new ConflictError("Planner session is not active.");
      }

      markPlannerSessionCanceled(session, userId);

      try {
        return await persistPlannerSession(client, session);
      } catch (error) {
        if (isMissingSupabaseTableError(error as { code?: string; message?: string }, "planner_sessions")) {
          return createDemoStore().cancelPlannerSession(threadId, userId);
        }

        throw error;
      }
    },
    async deleteLatestPlannerSession(threadId, userId) {
      await ensureSupabaseSeeded(client);
      assertPlannerParticipant(userId);

      const session = await loadLatestPlannerSessionOrNull(client, threadId);
      if (!session) {
        throw new NotFoundError("No planner session found for this thread.");
      }

      const { error } = await client.from("planner_sessions").delete().eq("id", session.id);
      if (error) {
        if (isMissingSupabaseTableError(error, "planner_sessions")) {
          return createDemoStore().deleteLatestPlannerSession(threadId, userId);
        }

        throw new Error(`Failed to delete planner session: ${error.message}`);
      }
    },
    async submitPlannerCriteria(threadId, userId, input) {
      await ensureSupabaseSeeded(client);
      assertPlannerParticipant(userId);

      const session = await loadLatestPlannerSessionForMutation(client, threadId, userId);
      if (session.status !== "collecting") {
        throw new ConflictError("Planner session is not collecting criteria.");
      }

      session.criteriaByUserId[userId] = createPlannerCriteriaAnswer(userId, input);
      const bucketItems = await listSavedPlannerBucketItems(client);
      await recalculatePlannerSession(session, bucketItems);
      session.updatedAt = nowIso();

      try {
        return await persistPlannerSession(client, session);
      } catch (error) {
        if (isMissingSupabaseTableError(error as { code?: string; message?: string }, "planner_sessions")) {
          return createDemoStore().submitPlannerCriteria(threadId, userId, input);
        }

        throw error;
      }
    },
    async submitPlannerVote(threadId, userId, bucketItemIds) {
      await ensureSupabaseSeeded(client);
      assertPlannerParticipant(userId);

      const session = await loadLatestPlannerSessionForMutation(client, threadId, userId);
      if (session.status !== "voting") {
        throw new ConflictError("Planner session is not ready for votes.");
      }

      assertValidPlannerVote(session, bucketItemIds);
      session.votesByUserId[userId] = {
        userId,
        bucketItemIds: [...bucketItemIds],
        submittedAt: nowIso()
      };
      finalizePlannerSessionIfReady(session);
      session.updatedAt = nowIso();

      try {
        return await persistPlannerSession(client, session);
      } catch (error) {
        if (isMissingSupabaseTableError(error as { code?: string; message?: string }, "planner_sessions")) {
          return createDemoStore().submitPlannerVote(threadId, userId, bucketItemIds);
        }

        throw error;
      }
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
      bucketItemEmbeddings: [],
      plannerSessions: []
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

type PlannerScoreCandidate = {
  recommendation: PlannerRecommendation;
  baseScore: number;
  hardConflict: boolean;
};

function createPlannerSession(threadId: string, initiatorUserId: PlannerSession["initiatorUserId"]): PlannerSession {
  const timestamp = nowIso();

  return {
    id: createId("planner-session"),
    threadId,
    initiatorUserId,
    status: "collecting",
    participants: [...plannerParticipants],
    criteriaByUserId: {},
    votesByUserId: {},
    recommendations: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function clonePlannerSession(session: PlannerSession): PlannerSession {
  return structuredClone(session);
}

function hydratePlannerSessionPhotos(session: PlannerSession | null, bucketItems: BucketItem[]): PlannerSession | null {
  if (!session) {
    return null;
  }

  const photoItemsById = new Map(
    bucketItems
      .filter((item) => item.photoUrl || item.photoSourceLinks?.length)
      .map((item) => [item.id, item])
  );

  if (photoItemsById.size === 0) {
    return session;
  }

  const hydrateItem = (item: BucketItem): BucketItem => {
    const source = photoItemsById.get(item.id);
    if (!source) {
      return item;
    }

    return {
      ...item,
      photoUrl: source.photoUrl,
      photoSourceLinks: source.photoSourceLinks
    };
  };

  session.recommendations = session.recommendations.map((recommendation) => ({
    ...recommendation,
    item: hydrateItem(recommendation.item)
  }));

  if (session.finalPlan) {
    session.finalPlan = {
      ...session.finalPlan,
      recommendation: {
        ...session.finalPlan.recommendation,
        item: hydrateItem(session.finalPlan.recommendation.item)
      },
      winningItems: session.finalPlan.winningItems.map(hydrateItem)
    };
  }

  return session;
}

function isActivePlannerSessionStatus(status: PlannerSessionStatus): boolean {
  return activePlannerSessionStatuses.has(status);
}

function markPlannerSessionCanceled(session: PlannerSession, canceledByUserId: PlannerParticipantId): void {
  session.status = "canceled";
  session.canceledAt = nowIso();
  session.canceledByUserId = canceledByUserId;
}

function getLatestPlannerSessionFromCollection(sessions: PlannerSession[], threadId: string): PlannerSession | null {
  const matches = sessions.filter((session) => session.threadId === threadId);
  if (matches.length === 0) {
    return null;
  }

  const latest = [...matches].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  return latest ? clonePlannerSession(latest) : null;
}

function findLatestMutablePlannerSession(sessions: PlannerSession[], threadId: string): PlannerSession {
  const latest = [...sessions]
    .filter((session) => session.threadId === threadId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  if (!latest) {
    throw new NotFoundError("No planner session found for this thread.");
  }

  return latest;
}

function assertPlannerParticipant(userId: string): asserts userId is PlannerParticipantId {
  if (!plannerParticipantSet.has(userId as PlannerParticipantId)) {
    throw new AuthorizationError("Only Jeff, Praya, and Tana can submit planner inputs.");
  }
}

function createPlannerCriteriaAnswer(
  userId: PlannerParticipantId,
  input: SubmitPlannerCriteriaInput
): PlannerCriteriaAnswer {
  const persona = personas.find((candidate) => candidate.id === userId);
  if (!persona) {
    throw new NotFoundError(`Missing persona configuration for ${userId}.`);
  }

  const resolvedBudget = resolvePlannerBudgetBounds(persona.defaultBudgetMax, input);

  return {
    userId,
    availabilityMode: input.availabilityMode,
    availability: input.availability,
    budgetMode: input.budgetMode,
    budgetAmount: input.budgetAmount,
    budgetMin: resolvedBudget.budgetMin,
    budgetMax: resolvedBudget.budgetMax,
    areaHints: [],
    vibeHints: [],
    budgetText: input.budgetText,
    vetoText: input.vetoText,
    vetoes: [...input.vetoes],
    budgetOption: input.budgetOption,
    submittedAt: nowIso()
  };
}

function resolvePlannerBudgetBounds(
  defaultBudgetMax: number,
  input: Pick<SubmitPlannerCriteriaInput, "budgetMode" | "budgetAmount" | "budgetOption" | "budgetText">
): { budgetMin: number; budgetMax: number } {
  if (input.budgetMode === "slider") {
    return {
      budgetMin: 0,
      budgetMax: normalizePlannerBudgetBound(input.budgetAmount)
    };
  }

  if (input.budgetOption) {
    const parsedOption = parseLegacyBudgetRange(input.budgetOption, input.budgetText);
    if (parsedOption) {
      return parsedOption;
    }
  }

  const parsedText = parseLegacyBudgetText(input.budgetText);
  if (parsedText) {
    return parsedText;
  }

  return {
    budgetMin: 0,
    budgetMax: defaultBudgetMax
  };
}

function parseLegacyBudgetRange(
  budgetOption: string,
  budgetText?: string
): { budgetMin: number; budgetMax: number } | null {
  const normalized = budgetOption.toLowerCase();
  if (
    (normalized.includes("under") && normalized.includes("10")) ||
    (normalized.includes("£10") && normalized.includes("under"))
  ) {
    return {
      budgetMin: 0,
      budgetMax: 10
    };
  }

  if (
    normalized.includes("10-20") ||
    normalized.includes("10 to 20") ||
    (normalized.includes("10") && normalized.includes("20"))
  ) {
    return {
      budgetMin: 10,
      budgetMax: 20
    };
  }

  if (
    normalized.includes("20+") ||
    normalized.includes("20 +") ||
    normalized.includes("20plus") ||
    normalized.includes("20 plus")
  ) {
    return {
      budgetMin: 20,
      budgetMax: 60
    };
  }

  const parsedText = parseLegacyBudgetText(budgetText);
  if (parsedText) {
    return parsedText;
  }

  return null;
}

function parseLegacyBudgetText(value?: string): { budgetMin: number; budgetMax: number } | null {
  if (!value) {
    return null;
  }

  const rangeMatch = value.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    return {
      budgetMin: normalizePlannerBudgetBound(Number.parseInt(rangeMatch[1], 10)),
      budgetMax: normalizePlannerBudgetBound(Number.parseInt(rangeMatch[2], 10))
    };
  }

  const singleMatch = value.match(/\d+/);
  if (!singleMatch) {
    return null;
  }

  return {
    budgetMin: 0,
    budgetMax: normalizePlannerBudgetBound(Number.parseInt(singleMatch[0], 10))
  };
}

function normalizePlannerBudgetBound(value: number): number {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded) || rounded < 0) {
    return 0;
  }
  if (rounded <= 40) {
    return rounded;
  }
  return 60;
}

async function recalculatePlannerSession(session: PlannerSession, bucketItems: BucketItem[]): Promise<void> {
  const criteria = getSubmittedPlannerCriteria(session);
  session.finalPlan = undefined;
  session.votesByUserId = {};

  if (criteria.length < plannerParticipants.length) {
    session.status = "collecting";
    session.proposedTime = undefined;
    session.aggregateCriteria = undefined;
    session.recommendations = [];
    return;
  }

  const aggregateCriteria = await buildPlannerAggregateCriteria(criteria).catch(() => buildFallbackAggregateCriteria(criteria));

  session.aggregateCriteria = aggregateCriteria;
  session.status = "voting";
  session.proposedTime = aggregateCriteria.proposedTime;
  session.recommendations = buildPlannerRecommendations(bucketItems, aggregateCriteria);
}

function getSubmittedPlannerCriteria(session: PlannerSession): PlannerCriteriaAnswer[] {
  return plannerParticipants
    .map((participant) => normalizeStoredPlannerCriteria(session.criteriaByUserId[participant]))
    .filter((criteria): criteria is PlannerCriteriaAnswer => criteria !== null);
}

function getSubmittedPlannerCriteriaFromState(state: Partial<PlannerSession>): PlannerCriteriaAnswer[] {
  return plannerParticipants
    .map((participant) => normalizeStoredPlannerCriteria(state.criteriaByUserId?.[participant]))
    .filter((criteria): criteria is PlannerCriteriaAnswer => criteria !== null);
}

function buildFallbackAggregateCriteria(criteria: PlannerCriteriaAnswer[]): PlannerAggregateCriteria {
  const budgetMin = Math.max(0, ...criteria.map((entry) => entry.budgetMin));
  const budgetMax = Math.min(...criteria.map((entry) => entry.budgetMax));
  const areaHints = dedupePlannerStringValues(criteria.map((entry) => entry.availability), 5);
  const vibeHints = dedupePlannerStringValues(criteria.flatMap((entry) => entry.vetoes), 8);
  const vetoes = dedupePlannerStringValues(criteria.flatMap((entry) => entry.vetoes), 8);
  const strictVetoes = vetoes.slice(0, 3);

  return {
    version: 1,
    budgetMin,
    budgetMax,
    availabilitySummary: "Group consensus",
    proposedTime: derivePlannerProposedTime(criteria),
    areaHints,
    vibeHints,
    vetoes,
    strictVetoes,
    source: "heuristic"
  };
}

function dedupePlannerStringValues(values: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const normalized = raw.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function normalizeStoredPlannerCriteria(raw: unknown): PlannerCriteriaAnswer | null {
  if (!isRecord(raw)) {
    return null;
  }

  const userId = raw.userId;
  if (!isPlannerParticipantId(userId)) {
    return null;
  }

  const persona = personas.find((candidate) => candidate.id === userId);
  if (!persona) {
    return null;
  }

  const availability = typeof raw.availability === "string" && raw.availability.trim().length > 0
    ? raw.availability.trim()
    : normalizePlannerAvailabilityFromLegacy(raw.availableTimes) || "Whenever";
  const availabilityMode = raw.availabilityMode === "Whenever" || raw.availabilityMode === "Custom" ? raw.availabilityMode : "Whenever";
  const budgetMode = raw.budgetMode === "slider" ? "slider" : "text";
  const budgetAmount = typeof raw.budgetAmount === "number" && Number.isFinite(raw.budgetAmount) ? raw.budgetAmount : 0;
  const legacyBudget = resolvePlannerBudgetBounds(persona.defaultBudgetMax, {
    budgetMode,
    budgetAmount,
    budgetOption: typeof raw.budgetOption === "string" ? raw.budgetOption : undefined,
    budgetText: typeof raw.budgetText === "string" ? raw.budgetText : undefined
  });
  const legacyBudgetMax = typeof raw.budgetMax === "number" && Number.isFinite(raw.budgetMax)
    ? normalizePlannerBudgetBound(raw.budgetMax)
    : undefined;
  const legacyBudgetMin = typeof raw.budgetMin === "number" && Number.isFinite(raw.budgetMin) ? normalizePlannerBudgetBound(raw.budgetMin) : 0;
  const derivedBudgetBounds =
    legacyBudgetMin > 0 || typeof legacyBudgetMax === "number"
      ? { budgetMin: Math.max(0, legacyBudgetMin), budgetMax: legacyBudgetMax ?? legacyBudget.budgetMax }
      : legacyBudget;
  const budgetBounds = budgetMode === "slider"
    ? { budgetMin: 0, budgetMax: normalizePlannerBudgetBound(budgetAmount) }
    : derivedBudgetBounds;
  const vetoes = normalizePlannerStringArray(raw.vetoes);
  const areaHints = normalizePlannerStringArray(raw.areaHints);
  const vibeHints = normalizePlannerStringArray(raw.vibeHints);

  return {
    userId,
    availability,
    availabilityMode,
    budgetMode,
    budgetAmount,
    budgetMin: budgetBounds.budgetMin,
    budgetMax: budgetBounds.budgetMax,
    areaHints,
    vibeHints,
    budgetText: typeof raw.budgetText === "string" ? raw.budgetText : undefined,
    vetoText: typeof raw.vetoText === "string" ? raw.vetoText : undefined,
    vetoes: dedupePlannerStringValues(vetoes, 8),
    budgetOption: typeof raw.budgetOption === "string" ? raw.budgetOption : undefined,
    submittedAt: typeof raw.submittedAt === "string" && raw.submittedAt.length > 0 ? raw.submittedAt : nowIso()
  };
}

function normalizePlannerAvailabilityFromLegacy(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const text = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(", ");

  return text.length > 0 ? text : null;
}

function derivePlannerProposedTime(criteria: PlannerCriteriaAnswer[]): string {
  const normalized = criteria.map((entry) => entry.availability.toLowerCase());
  const everyoneHasSunday = normalized.every((value) => value.includes("sunday"));
  if (everyoneHasSunday) {
    return "Sunday 14:00";
  }

  const everyoneHasEvening = normalized.every(
    (value) => value.includes("after office") || value.includes("after 7") || value.includes("tonight")
  );
  if (everyoneHasEvening) {
    return normalized.some((value) => value.includes("tonight")) ? "Today 19:30" : "Friday 19:30";
  }

  return "Saturday 12:00";
}

function buildPlannerRecommendations(
  bucketItems: BucketItem[],
  aggregateCriteria: PlannerAggregateCriteria
): PlannerRecommendation[] {
  const pool = sortNewest(
    bucketItems.filter(
      (item) => item.status === "saved" && plannerParticipantSet.has(item.userId as PlannerParticipantId)
    )
  );
  const newestUpdatedAt = pool[0]?.updatedAt ?? nowIso();
  const candidates = pool.map((item) => scorePlannerCandidate(item, aggregateCriteria, newestUpdatedAt));
  const strictCandidates = candidates.filter((candidate) => !candidate.hardConflict);
  const fallbackCandidates = candidates.filter((candidate) => candidate.hardConflict);
  const ranked = selectPlannerRecommendations(strictCandidates, 3);

  if (ranked.length < 3) {
    ranked.push(...selectPlannerRecommendations(fallbackCandidates, 3 - ranked.length, ranked.map((entry) => entry.bucketItemId)));
  }

  return ranked.slice(0, 3);
}

function scorePlannerCandidate(
  item: BucketItem,
  aggregateCriteria: PlannerAggregateCriteria,
  newestUpdatedAt: string
): PlannerScoreCandidate {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const searchText = createPlannerSearchText(item);
  const areaText = `${item.locationName} ${item.neighborhood} ${item.address}`.toLowerCase();
  const groupBudgetMax = Math.max(aggregateCriteria.budgetMax, aggregateCriteria.budgetMin);
  const budgetDelta = item.estimatedCost - groupBudgetMax;
  let score = 0;
  let hardConflict = false;

  if (item.estimatedCost <= groupBudgetMax) {
    score += 32;
    reasons.push(`Fits the shared budget cap at about £${item.estimatedCost}.`);
  } else if (budgetDelta <= 10) {
    score += 14;
    warnings.push(`Sits about £${budgetDelta} over the tightest budget cap.`);
  } else {
    warnings.push(`Well above the tightest budget cap at about £${item.estimatedCost}.`);
  }

  const vetoWarnings = new Set<string>();
  for (const veto of aggregateCriteria.vetoes) {
    const match = classifyPlannerVeto(veto, item, searchText);
    if (!match) {
      continue;
    }

    if (match.hardConflict) {
      hardConflict = true;
    }

    if (match.warning) {
      vetoWarnings.add(match.warning);
    }
  }

  for (const veto of aggregateCriteria.strictVetoes) {
    const match = classifyPlannerVeto(veto, item, searchText, true);
    if (!match) {
      continue;
    }
    hardConflict = true;
    vetoWarnings.add(match.warning ?? `Conflicts with strict veto: ${veto}.`);
  }

  if (!hardConflict) {
    score += 24;
    reasons.push("No clear hard conflict against the submitted vetoes.");
  }

  warnings.push(...vetoWarnings);

  const enrichmentBonus =
    item.enrichmentStatus === "complete" ? 12 : item.enrichmentStatus === "partial" ? 8 : item.enrichmentStatus === "fallback" ? 5 : 4;
  score += enrichmentBonus + Math.round(item.confidence * 10);
  reasons.push(item.enrichmentStatus === "complete" ? "High-confidence details are already filled in." : "Details are good enough to act on quickly.");

  const recencyBonus = calculatePlannerRecencyBonus(item.updatedAt, newestUpdatedAt);
  score += recencyBonus;

  for (const vibeHint of aggregateCriteria.vibeHints) {
    if (searchText.includes(vibeHint.toLowerCase()) || item.category.toLowerCase() === vibeHint.toLowerCase()) {
      score += 8;
      reasons.push(`Matches vibe hint: ${vetoToLabel(vibeHint)}.`);
      break;
    }
  }

  for (const areaHint of aggregateCriteria.areaHints) {
    if (areaText.includes(areaHint.toLowerCase())) {
      score += 6;
      reasons.push(`Matches area hint: ${areaHint}.`);
      break;
    }
  }

  if (aggregateCriteria.availabilitySummary.toLowerCase().includes("evening") && !item.openingHours) {
    warnings.push("Opening time details are missing; verify it works for evening plans.");
  } else if (aggregateCriteria.availabilitySummary.toLowerCase().includes("tonight") && item.category !== "nightlife") {
    warnings.push("Tonight preference might be less ideal for this place type.");
  }

  if (item.category === "culture" || item.category === "activity" || item.category === "shopping") {
    score += 4;
    reasons.push("Gives the group a non-standard plan option beyond a standard dinner.");
  } else if (item.category === "restaurant" || item.category === "cafe") {
    score += 2;
  }

  if (warnings.length === 0) {
    warnings.push("Check live opening hours before locking it in.");
  }

  return {
    recommendation: createPlannerRecommendation(item, score, reasons, warnings),
    baseScore: score,
    hardConflict
  };
}

function createPlannerRecommendation(
  item: BucketItem,
  rawScore: number,
  reasons: string[],
  warnings: string[]
): PlannerRecommendation {
  const ownerPersona = personas.find((persona) => persona.id === item.userId);

  return {
    owner: {
      id: item.userId,
      name: ownerPersona?.name ?? item.userId
    },
    bucketItemId: item.id,
    item,
    score: Math.max(0, Math.min(100, rawScore)),
    reasons: reasons.slice(0, 3),
    warnings: warnings.slice(0, 3),
    mapsUrl: buildPlannerMapsUrl(item)
  };
}

function buildPlannerMapsUrl(item: BucketItem): string | null {
  const searchText = [item.address, item.postalCode, item.locationName, item.neighborhood, item.title].filter(Boolean).join(", ");
  if (!searchText) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchText)}`;
}

function calculatePlannerRecencyBonus(updatedAt: string, newestUpdatedAt: string): number {
  if (updatedAt === newestUpdatedAt) {
    return 8;
  }

  const ageMs = Math.max(0, Date.parse(newestUpdatedAt) - Date.parse(updatedAt));
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 1) {
    return 6;
  }
  if (ageDays <= 3) {
    return 4;
  }
  return 2;
}

function createPlannerSearchText(item: BucketItem): string {
  return [
    item.title,
    item.description,
    item.whyInteresting,
    item.locationName,
    item.neighborhood,
    item.address,
    item.postalCode,
    item.category,
    item.tags.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function vetoToLabel(value: string): string {
  return value.trim() || "group preference";
}

function classifyPlannerVeto(
  veto: string,
  item: BucketItem,
  searchText: string,
  strict = false
): { hardConflict: boolean; warning?: string } | null {
  const normalized = veto.toLowerCase();
  const tokens = getVetoTokens(normalized);

  if (strict && tokens.length > 0 && tokens.every((token) => searchText.includes(token))) {
    return {
      hardConflict: true,
      warning: `Strict veto conflict: ${veto}.`
    };
  }

  if (strict) {
    // strict vetoes are intended to be absolute, so even partial matches should block the suggestion.
    if (tokens.length > 0 && tokens.some((token) => searchText.includes(token))) {
      return {
        hardConflict: true,
        warning: `Strict veto conflict: ${veto}.`
      };
    }
  }

  if ((normalized.includes("no seafood") || normalized === "seafood") && searchText.includes("seafood")) {
    return { hardConflict: true, warning: "Conflicts with a no-seafood veto." };
  }

  if (
    normalized.includes("no alcohol") &&
    (item.category === "nightlife" ||
      /\b(cocktail|pub|club|alcohol|wine|beer|drinks)\b/.test(searchText))
  ) {
    return { hardConflict: true, warning: "Conflicts with a no-alcohol veto." };
  }

  if (normalized.includes("halal")) {
    if (searchText.includes("halal")) {
      return null;
    }

    return { hardConflict: false, warning: "Halal suitability is not clearly confirmed." };
  }

  if ((normalized.includes("queue") || normalized.includes("queues")) && /\b(queue|queues|busy)\b/.test(searchText)) {
    return { hardConflict: true, warning: "May conflict with a no-queues preference." };
  }

  const significantTokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !["only", "with", "that", "this", "from"].includes(token));
  if (significantTokens.some((token) => searchText.includes(token))) {
    return { hardConflict: true, warning: `May conflict with veto: ${veto}.` };
  }

  return null;
}

function selectPlannerRecommendations(
  candidates: PlannerScoreCandidate[],
  limit: number,
  excludedIds: string[] = []
): PlannerRecommendation[] {
  const selected: PlannerRecommendation[] = [];
  const usedIds = new Set<string>(excludedIds);
  const remaining = [...candidates];

  while (selected.length < limit && remaining.length > 0) {
    remaining.sort((left, right) => {
      const leftScore = adjustedPlannerScore(left, selected);
      const rightScore = adjustedPlannerScore(right, selected);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      if (right.baseScore !== left.baseScore) {
        return right.baseScore - left.baseScore;
      }

      return left.recommendation.bucketItemId.localeCompare(right.recommendation.bucketItemId);
    });

    const next = remaining.find((candidate) => !usedIds.has(candidate.recommendation.bucketItemId));
    if (!next) {
      break;
    }

    usedIds.add(next.recommendation.bucketItemId);
    remaining.splice(remaining.indexOf(next), 1);
    selected.push({
      ...next.recommendation,
      score: Math.max(0, Math.min(100, adjustedPlannerScore(next, selected)))
    });
  }

  return selected;
}

function adjustedPlannerScore(candidate: PlannerScoreCandidate, selected: PlannerRecommendation[]): number {
  let bonus = 0;
  if (!selected.some((entry) => entry.item.userId === candidate.recommendation.item.userId)) {
    bonus += 5;
  }
  if (!selected.some((entry) => entry.item.category === candidate.recommendation.item.category)) {
    bonus += 5;
  }
  return candidate.baseScore + bonus;
}

function assertValidPlannerVote(session: PlannerSession, bucketItemIds: string[]): void {
  const validIds = new Set(session.recommendations.map((recommendation) => recommendation.bucketItemId));
  if (bucketItemIds.length === 0 || bucketItemIds.length > 3) {
    throw new ConflictError("Planner vote requires 1 to 3 recommendation ids.");
  }

  for (const bucketItemId of bucketItemIds) {
    if (!validIds.has(bucketItemId)) {
      throw new ConflictError("Planner vote contains an item that is not in the current recommendation set.");
    }
  }
}

function finalizePlannerSessionIfReady(session: PlannerSession): void {
  const votes = plannerParticipants
    .map((participant) => session.votesByUserId[participant])
    .filter((vote): vote is PlannerVote => Boolean(vote));

  if (votes.length < plannerParticipants.length) {
    return;
  }

  const voteCounts: Record<string, number> = {};
  for (const vote of votes) {
    for (const bucketItemId of vote.bucketItemIds) {
      voteCounts[bucketItemId] = (voteCounts[bucketItemId] ?? 0) + 1;
    }
  }

  const maxVotes = Math.max(...Object.values(voteCounts));
  const winnerIds = session.recommendations
    .map((recommendation) => recommendation.bucketItemId)
    .filter((bucketItemId) => (voteCounts[bucketItemId] ?? 0) === maxVotes);
  const winningRecommendations = session.recommendations.filter((recommendation) => winnerIds.includes(recommendation.bucketItemId));
  const winnerId = winnerIds[0];
  const winningRecommendation = winningRecommendations[0] ?? session.recommendations.find((recommendation) => recommendation.bucketItemId === winnerId);

  if (!winnerId || !winningRecommendation) {
    throw new ConflictError("Planner session could not resolve a final winner.");
  }

  session.status = "completed";
  session.finalPlan = {
    bucketItemId: winnerId,
    recommendation: winningRecommendation,
    winningItems: winningRecommendations.map((recommendation) => recommendation.item),
    proposedTime: session.proposedTime ?? "Saturday 12:00",
    calendarUrl: buildPlannerCalendarUrl(session.threadId),
    winnerIds,
    tiedWinnerIds: winnerIds.length > 1 ? winnerIds : [],
    voteCounts
  };
}

function buildPlannerCalendarUrl(threadId: string): string {
  return `/api/planner-session/calendar?threadId=${encodeURIComponent(threadId)}`;
}

async function listSavedPlannerBucketItems(client: SupabaseClient): Promise<BucketItem[]> {
  const { data, error } = await client
    .from("bucket_items")
    .select("*")
    .eq("status", "saved")
    .in("user_id", plannerParticipants)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load planner bucket items: ${error.message}`);
  }

  return (data ?? []).map(mapBucketItemRowToDomain);
}

async function loadLatestPlannerSessionOrNull(client: SupabaseClient, threadId: string): Promise<PlannerSession | null> {
  const { data, error } = await client
    .from("planner_sessions")
    .select("*")
    .eq("thread_id", threadId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTableError(error, "planner_sessions")) {
      plannerSessionsTableMissing = true;
      return createDemoStore().getLatestPlannerSession(threadId);
    }

    throw new Error(`Failed to load planner session: ${error.message}`);
  }

  plannerSessionsTableMissing = false;
  return data ? mapPlannerSessionRowToDomain(data as PlannerSessionRow) : null;
}

async function loadLatestPlannerSessionForMutation(
  client: SupabaseClient,
  threadId: string,
  fallbackUserId?: PlannerParticipantId
): Promise<PlannerSession> {
  const data = await loadLatestPlannerSessionOrNull(client, threadId);
  if (!data) {
    if (fallbackUserId && plannerSessionsTableMissing) {
      return createDemoStore().createOrResumePlannerSession(threadId, fallbackUserId);
    }

    throw new NotFoundError("No planner session found for this thread.");
  }

  return data;
}

async function persistPlannerSession(client: SupabaseClient, session: PlannerSession): Promise<PlannerSession> {
  const { data, error } = await client
    .from("planner_sessions")
    .upsert(mapPlannerSessionDomainToRow(session), { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to persist planner session: ${error.message}`);
  }

  return mapPlannerSessionRowToDomain(data as PlannerSessionRow);
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
    photoUrl: normalizeOptionalText(input.photoUrl),
    photoSourceLinks: normalizeStringArray(input.photoSourceLinks),
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
    photo_url: item.photoUrl ?? null,
    photo_source_links: item.photoSourceLinks ?? [],
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
  const category = normalizePlaceCategory(row.category);

  return {
    id: row.id,
    userId: row.user_id as BucketItem["userId"],
    status: row.status as BucketItemStatus,
    dateType: row.date_type as BucketItemDateType,
    title: row.title,
    category,
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
    photoUrl: row.photo_url ?? undefined,
    photoSourceLinks: normalizeStringArray(row.photo_source_links),
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

function mapPlannerSessionDomainToRow(session: PlannerSession): PlannerSessionRow {
  return {
    id: session.id,
    thread_id: session.threadId,
    initiator_user_id: session.initiatorUserId,
    status: isActivePlannerSessionStatus(session.status) ? session.status : "completed",
    state: clonePlannerSession(session),
    created_at: session.createdAt,
    updated_at: session.updatedAt
  };
}

function mapPlannerSessionRowToDomain(row: PlannerSessionRow): PlannerSession {
  const state = structuredClone(row.state ?? {}) as Partial<PlannerSession>;
  const status = normalizePlannerSessionStatus(state.status) ?? normalizePlannerSessionStatus(row.status) ?? "collecting";
  const participants =
    Array.isArray(state.participants) && state.participants.length > 0
      ? state.participants.filter((participant): participant is PlannerParticipantId => plannerParticipantSet.has(participant))
      : [...plannerParticipants];
  const recommendations = normalizePlannerRecommendations(state.recommendations);
  const finalPlan = normalizePlannerFinalPlan(state.finalPlan, recommendations, row.thread_id);
  const criteriaByUserId = getSubmittedPlannerCriteriaFromState(state);
  const aggregateCriteria = normalizeAggregateCriteria(state.aggregateCriteria, criteriaByUserId);

  return {
    id: row.id,
    threadId: row.thread_id,
    initiatorUserId: (state.initiatorUserId ?? row.initiator_user_id) as PlannerSession["initiatorUserId"],
    status,
    participants: participants.length === plannerParticipants.length ? participants : [...plannerParticipants],
    criteriaByUserId: criteriaByUserId.reduce((acc, criteria) => {
      acc[criteria.userId] = criteria;
      return acc;
    }, {} as PlannerSession["criteriaByUserId"]),
    votesByUserId: (state.votesByUserId ?? {}) as PlannerSession["votesByUserId"],
    aggregateCriteria,
    recommendations,
    proposedTime: state.proposedTime,
    finalPlan,
    createdAt: state.createdAt ?? row.created_at,
    updatedAt: state.updatedAt ?? row.updated_at,
    canceledAt: state.canceledAt,
    canceledByUserId: normalizePlannerParticipantId(state.canceledByUserId)
  };
}

function normalizePlannerSessionStatus(raw: unknown): PlannerSessionStatus | null {
  if (raw === "collecting" || raw === "voting" || raw === "completed" || raw === "canceled") {
    return raw;
  }

  return null;
}

function normalizePlannerParticipantId(raw: unknown): PlannerParticipantId | undefined {
  return raw === "jeff" || raw === "praya" || raw === "tana" ? raw : undefined;
}

function normalizeAggregateCriteria(
  raw: unknown,
  criteriaByUserId: PlannerCriteriaAnswer[]
): PlannerAggregateCriteria {
  if (!isRecord(raw)) {
    return buildFallbackAggregateCriteria(criteriaByUserId);
  }

  const budgetMin =
    typeof raw.budgetMin === "number" && Number.isFinite(raw.budgetMin) ? normalizePlannerBudgetBound(raw.budgetMin) : 0;
  const budgetMax =
    typeof raw.budgetMax === "number" && Number.isFinite(raw.budgetMax)
      ? normalizePlannerBudgetBound(raw.budgetMax)
      : 60;
  const source = raw.source === "gemini" ? "gemini" : "heuristic";
  const availabilitySummary =
    typeof raw.availabilitySummary === "string" && raw.availabilitySummary.trim().length > 0
      ? raw.availabilitySummary.trim()
      : "Group consensus";
  const proposedTime =
    typeof raw.proposedTime === "string" && raw.proposedTime.trim().length > 0 ? raw.proposedTime.trim() : "Saturday 12:00";
  const areaHints = normalizePlannerStringArray(raw.areaHints);
  const vibeHints = normalizePlannerStringArray(raw.vibeHints);
  const vetoes = normalizePlannerStringArray(raw.vetoes);
  const strictVetoes = normalizePlannerStringArray(raw.strictVetoes).slice(0, 6);

  if (!availabilitySummary && !proposedTime) {
    return buildFallbackAggregateCriteria(criteriaByUserId);
  }

  return {
    version: 1,
    budgetMin,
    budgetMax,
    availabilitySummary,
    proposedTime,
    areaHints,
    vibeHints,
    vetoes,
    strictVetoes,
    source,
    confidence: normalizeAggregateConfidence(raw.confidence)
  };
}

function normalizeAggregateConfidence(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(1, raw));
  }

  return undefined;
}

function normalizePlannerRecommendations(raw: unknown): PlannerRecommendation[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const recommendations = raw
    .map((entry) => normalizePlannerRecommendation(entry))
    .filter((entry): entry is PlannerRecommendation => Boolean(entry))
    .map((entry) => ({
      ...entry,
      owner: ensurePlannerRecommendationOwner(entry.owner, entry.item.userId),
      mapsUrl: entry.mapsUrl ?? buildPlannerMapsUrl(entry.item)
    }));

  return dedupePlannerRecommendationsById(recommendations);
}

function normalizePlannerRecommendation(value: unknown): PlannerRecommendation | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!isRecord(value.item) || !isRecord((value.item as Record<string, unknown>).tags)) {
    return null;
  }

  const item = value.item as BucketItem;
  const owner = ensurePlannerRecommendationOwner(value.owner, item.userId);
  const rawScore = typeof value.score === "number" && Number.isFinite(value.score) ? value.score : 0;
  const bucketItemId = typeof value.bucketItemId === "string" && value.bucketItemId.length > 0 ? value.bucketItemId : item.id;
  const reasons = normalizeStringArray((value as { reasons?: unknown }).reasons);
  const warnings = normalizeStringArray((value as { warnings?: unknown }).warnings);

  return {
    owner,
    bucketItemId,
    item,
    score: Math.max(0, Math.min(100, Math.round(rawScore))),
    reasons: reasons.slice(0, 3),
    warnings: warnings.slice(0, 3),
    distanceLabel: normalizePlannerOptionalText((value as { distanceLabel?: unknown }).distanceLabel),
    mapsUrl: normalizePlannerOptionalText((value as { mapsUrl?: unknown }).mapsUrl) ?? buildPlannerMapsUrl(item)
  };
}

function normalizePlannerFinalPlan(
  raw: unknown,
  recommendations: PlannerRecommendation[],
  threadId: string
): PlannerFinalPlan | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const winnerId =
    typeof raw.bucketItemId === "string" && raw.bucketItemId.length > 0
      ? raw.bucketItemId
      : undefined;
  const recommendation = normalizePlannerRecommendation(raw.recommendation);
  const winnerIds = dedupePlannerRecommendationIds([
    ...normalizePlannerStringArray(raw.winnerIds),
    ...(winnerId ? [winnerId] : []),
    ...(recommendation ? [recommendation.bucketItemId] : [])
  ]);

  if (winnerIds.length === 0) {
    return undefined;
  }

  const winningRecommendations = recommendations.filter((entry) => winnerIds.includes(entry.bucketItemId));
  const winningRecommendation = winningRecommendations.find((entry) => entry.bucketItemId === winnerIds[0]) ?? recommendation;
  const winningItems = winningRecommendations.map((entry) => entry.item);
  const fallbackWinningItem = recommendation?.item;

  if (!winningRecommendation || (!winningItems.length && !fallbackWinningItem)) {
    return undefined;
  }

  const parsedVoteCounts =
    raw.voteCounts && typeof raw.voteCounts === "object" && raw.voteCounts !== null
      ? (raw.voteCounts as Record<string, unknown>)
      : {};
  const tiedWinnerIds = normalizePlannerStringArray(raw.tiedWinnerIds).filter((entry) => winnerIds.includes(entry));
  const winnerWithTieIds = winnerIds.length > 1 ? winnerIds : [];

  return {
    bucketItemId: winningRecommendation.bucketItemId,
    recommendation: normalizePlannerRecommendation(winningRecommendation) ?? winningRecommendation,
    winningItems: (winningItems.length > 0 ? winningItems : [fallbackWinningItem]).filter(Boolean) as PlannerFinalPlan["winningItems"],
    proposedTime:
      typeof raw.proposedTime === "string" && raw.proposedTime.length > 0 ? raw.proposedTime : "Saturday 12:00",
    calendarUrl: buildPlannerCalendarUrl(threadId),
    winnerIds,
    tiedWinnerIds: winnerWithTieIds.length > 0 ? winnerWithTieIds : tiedWinnerIds,
    voteCounts: normalizePlannerVoteCounts(parsedVoteCounts)
  };
}

function normalizePlannerStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    entries.add(trimmed);
  }

  return Array.from(entries);
}

function normalizePlannerVoteCounts(value: Record<string, unknown>): Record<string, number> {
  const voteCounts: Record<string, number> = {};
  for (const [bucketItemId, rawCount] of Object.entries(value)) {
    const count = typeof rawCount === "number" && Number.isFinite(rawCount) ? rawCount : Number.NaN;
    if (!Number.isFinite(count) || count <= 0) {
      continue;
    }

    voteCounts[bucketItemId] = Math.round(count);
  }

  return voteCounts;
}

function isPlannerParticipantId(value: unknown): value is PlannerParticipantId {
  return typeof value === "string" && plannerParticipantSet.has(value as PlannerParticipantId);
}

function getVetoTokens(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !["only", "with", "that", "this", "from"].includes(token));
}

function dedupePlannerRecommendationIds(entries: string[]): string[] {
  return Array.from(new Set(entries));
}

function dedupePlannerRecommendationsById<T extends { bucketItemId: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const entry of entries) {
    if (seen.has(entry.bucketItemId)) {
      continue;
    }

    seen.add(entry.bucketItemId);
    result.push(entry);
  }

  return result;
}

function ensurePlannerRecommendationOwner(value: unknown, fallbackUserId: BucketItem["userId"]): PlannerRecommendation["owner"] {
  if (isRecord(value) && typeof value.id === "string") {
    const fallbackName = personas.find((persona) => persona.id === value.id)?.name;
    if (fallbackName) {
      return {
        id: value.id as BucketItem["userId"],
        name: fallbackName
      };
    }
  }

  const fallbackPersona = personas.find((persona) => persona.id === fallbackUserId);
  return {
    id: fallbackUserId,
    name: fallbackPersona?.name ?? fallbackUserId
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePlannerOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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
