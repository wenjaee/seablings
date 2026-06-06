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
  SourcePlatform
} from "@/lib/domain";
import { personas, seededBucketItems, seededCriteria, seededMessages, seededRecommendations } from "@/lib/fixtures";
import type { ListBucketItemFilters, ListCaptureFilters, ManualBucketItemInput } from "@/lib/server/validation";

type StoreMode = "demo" | "supabase";

type DrainFailure = {
  taskId: string;
  message: string;
};

type DrainQueueResult = {
  processedTasks: IngestionTask[];
  createdItems: BucketItem[];
  failures: DrainFailure[];
  remainingQueue: number;
};

type BackendStore = {
  mode: StoreMode;
  listCaptures(filters?: ListCaptureFilters): Promise<IngestionTask[]>;
  createCaptureTask(payload: CapturePayload): Promise<IngestionTask>;
  drainQueue(limit?: number): Promise<DrainQueueResult>;
  listBucketItems(filters?: ListBucketItemFilters): Promise<BucketItem[]>;
  createBucketItem(input: ManualBucketItemInput): Promise<BucketItem>;
  updateBucketItemStatus(id: string, status: BucketItemStatus): Promise<BucketItem | null>;
};

type DemoState = {
  personas: Persona[];
  criteria: PlanningCriteria[];
  recommendations: Recommendation[];
  messages: ChatMessage[];
  tasks: IngestionTask[];
  bucketItems: BucketItem[];
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
    async drainQueue(limit) {
      const state = getDemoState();
      const queuedTasks = state.tasks
        .filter((task) => task.status === "queued")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .slice(0, normalizeLimit(limit));
      const processedTasks: IngestionTask[] = [];
      const createdItems: BucketItem[] = [];

      for (const task of queuedTasks) {
        task.status = "processing";
        task.updatedAt = nowIso();

        const item = buildCandidateBucketItem(task);

        task.status = "completed";
        task.updatedAt = nowIso();
        state.bucketItems.unshift(item);
        processedTasks.push({ ...task });
        createdItems.push(item);
      }

      return {
        processedTasks,
        createdItems,
        failures: [],
        remainingQueue: state.tasks.filter((task) => task.status === "queued").length
      };
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
      const item: BucketItem = {
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
        priceEstimate: input.priceEstimate,
        estimatedCost: input.estimatedCost ?? 0,
        openingHours: input.openingHours,
        websiteUrl: input.websiteUrl,
        sourceUrl: input.sourceUrl,
        sourceType: input.sourceType ?? "manual",
        tags: input.tags ?? [],
        confidence: input.confidence ?? 0.7,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      state.bucketItems.unshift(item);
      return item;
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
    async drainQueue(limit) {
      await ensureSupabaseSeeded(client);

      const { data, error } = await client
        .from("ingestion_tasks")
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(normalizeLimit(limit));

      if (error) {
        throw new Error(`Failed to load queued captures: ${error.message}`);
      }

      const queuedTasks = (data ?? []).map(mapTaskRowToDomain);
      const processedTasks: IngestionTask[] = [];
      const createdItems: BucketItem[] = [];
      const failures: DrainFailure[] = [];

      for (const task of queuedTasks) {
        const processingTask = await updateSupabaseTaskStatus(client, task.id, "processing");
        if (!processingTask) {
          failures.push({ taskId: task.id, message: "Task disappeared before processing." });
          continue;
        }

        try {
          const item = buildCandidateBucketItem(processingTask);
          const { data: insertedItem, error: insertError } = await client
            .from("bucket_items")
            .insert(mapBucketItemDomainToRow(item))
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }

          const completedTask = await updateSupabaseTaskStatus(client, task.id, "completed");
          if (!completedTask) {
            throw new Error("Task could not be marked completed.");
          }

          processedTasks.push(completedTask);
          createdItems.push(mapBucketItemRowToDomain(insertedItem as BucketItemRow));
        } catch (error) {
          console.error("Queue drain failed for capture", { taskId: task.id, error });
          await updateSupabaseTaskStatus(client, task.id, "failed");
          failures.push({ taskId: task.id, message: error instanceof Error ? error.message : "Unknown drain failure." });
        }
      }

      const { count, error: countError } = await client
        .from("ingestion_tasks")
        .select("*", { head: true, count: "exact" })
        .eq("status", "queued");

      if (countError) {
        throw new Error(`Failed to count remaining queue: ${countError.message}`);
      }

      return {
        processedTasks,
        createdItems,
        failures,
        remainingQueue: count ?? 0
      };
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
      const item: BucketItem = {
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
        priceEstimate: input.priceEstimate,
        estimatedCost: input.estimatedCost ?? 0,
        openingHours: input.openingHours,
        websiteUrl: input.websiteUrl,
        sourceUrl: input.sourceUrl,
        sourceType: input.sourceType ?? "manual",
        tags: input.tags ?? [],
        confidence: input.confidence ?? 0.7,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const { data, error } = await client.from("bucket_items").insert(mapBucketItemDomainToRow(item)).select().single();
      if (error) {
        throw new Error(`Failed to create bucket item: ${error.message}`);
      }

      return mapBucketItemRowToDomain(data as BucketItemRow);
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
      tasks: [],
      bucketItems: structuredClone(seededBucketItems)
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
    const { count, error } = await client.from("personas").select("*", { head: true, count: "exact" });
    if (error) {
      throw new Error(`Failed to inspect Supabase seed state: ${error.message}`);
    }

    if ((count ?? 0) > 0) {
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

async function updateSupabaseTaskStatus(
  client: SupabaseClient,
  taskId: string,
  status: IngestionTaskStatus
): Promise<IngestionTask | null> {
  const { data, error } = await client
    .from("ingestion_tasks")
    .update({ status, updated_at: nowIso() })
    .eq("id", taskId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update task status: ${error.message}`);
  }

  return data ? mapTaskRowToDomain(data as IngestionTaskRow) : null;
}

function buildCandidateBucketItem(task: IngestionTask): BucketItem {
  const persona = personas.find((candidate) => candidate.id === task.userId);
  const title = deriveTitle(task);
  const category = deriveCategory(task);
  const description = deriveDescription(task);
  const neighborhood = deriveNeighborhood(task);
  const timestamp = nowIso();
  const tags = deriveTags(task, category);
  const dateType = deriveDateType(task);

  return {
    id: createId("item"),
    userId: task.userId,
    status: "candidate",
    dateType,
    title,
    category,
    description,
    whyInteresting: `Captured from ${task.sourceType} for ${persona?.name ?? task.userId} and ready for review.`,
    locationName: title,
    neighborhood,
    address: undefined,
    postalCode: persona?.postalCode,
    priceEstimate: estimatePrice(category),
    estimatedCost: estimateCost(category, persona?.defaultBudgetMax),
    openingHours: dateType === "scheduled" ? "Check source for schedule" : "Check venue hours",
    websiteUrl: undefined,
    sourceUrl: task.sourceUrl,
    sourceType: task.sourceType,
    tags,
    confidence: deriveConfidence(task),
    startsAt: inferStartsAt(task, dateType),
    endsAt: undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function deriveTitle(task: IngestionTask): string {
  const rawText = task.text?.trim();
  if (rawText) {
    return rawText.replace(/\s+/g, " ").slice(0, 56);
  }

  if (task.screenshotName) {
    return task.screenshotName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 56);
  }

  if (task.sourceUrl) {
    try {
      const url = new URL(task.sourceUrl);
      const candidate = url.pathname
        .split("/")
        .filter(Boolean)
        .at(-1)
        ?.replace(/[-_]+/g, " ")
        .slice(0, 56);

      return candidate || url.hostname.replace(/^www\./, "");
    } catch {
      return task.sourceUrl.slice(0, 56);
    }
  }

  return "Captured idea";
}

function deriveDescription(task: IngestionTask): string {
  const sourceLabel = task.sourceType === "manual" ? "manual note" : task.sourceType;
  if (task.text?.trim()) {
    return task.text.trim();
  }

  if (task.sourceUrl) {
    return `Imported from ${sourceLabel}: ${task.sourceUrl}`;
  }

  if (task.screenshotName) {
    return `Imported from screenshot: ${task.screenshotName}`;
  }

  return `Imported from ${sourceLabel}.`;
}

function deriveCategory(task: IngestionTask): BucketCategory {
  const haystack = `${task.text ?? ""} ${task.sourceUrl ?? ""} ${task.screenshotName ?? ""}`.toLowerCase();

  if (matchesAny(haystack, ["restaurant", "dinner", "food", "brunch", "eat", "dish"])) {
    return "eats";
  }
  if (matchesAny(haystack, ["bar", "cocktail", "wine", "pub", "drinks"])) {
    return "drinks";
  }
  if (matchesAny(haystack, ["coffee", "cafe", "matcha", "bakery"])) {
    return "cafe";
  }
  if (matchesAny(haystack, ["club", "dj", "late", "nightlife"])) {
    return "nightlife";
  }
  if (matchesAny(haystack, ["museum", "gallery", "exhibition", "culture"])) {
    return "culture";
  }
  if (matchesAny(haystack, ["market", "stall", "food hall"])) {
    return "market";
  }
  if (matchesAny(haystack, ["padel", "climb", "workshop", "activity", "class"])) {
    return "activity";
  }
  if (matchesAny(haystack, ["hidden", "secret", "gem"])) {
    return "hidden_gem";
  }

  return "other";
}

function deriveNeighborhood(task: IngestionTask): string {
  const haystack = `${task.text ?? ""} ${task.sourceUrl ?? ""} ${task.screenshotName ?? ""}`.toLowerCase();
  const knownNeighborhoods = [
    "shoreditch",
    "brixton",
    "king's cross",
    "kings cross",
    "bankside",
    "walthamstow",
    "farringdon",
    "london bridge",
    "earls court"
  ];

  const match = knownNeighborhoods.find((candidate) => haystack.includes(candidate));
  if (match) {
    return match.replace("kings cross", "King's Cross").replace("earls court", "Earls Court");
  }

  return "London";
}

function deriveTags(task: IngestionTask, category: BucketCategory): string[] {
  const tags = new Set<string>([task.sourceType, category]);
  const haystack = `${task.text ?? ""} ${task.sourceUrl ?? ""}`.toLowerCase();

  if (haystack.includes("group")) {
    tags.add("group");
  }
  if (matchesAny(haystack, ["cheap", "budget", "free"])) {
    tags.add("budget");
  }
  if (matchesAny(haystack, ["tonight", "friday", "saturday", "sunday"])) {
    tags.add("timed");
  }
  if (matchesAny(haystack, ["date", "romantic"])) {
    tags.add("date");
  }

  return Array.from(tags);
}

function deriveDateType(task: IngestionTask): BucketItemDateType {
  const haystack = `${task.text ?? ""} ${task.sourceUrl ?? ""}`.toLowerCase();

  if (matchesAny(haystack, ["today", "tonight", "friday", "saturday", "sunday", "this week"])) {
    return "scheduled";
  }

  return "anytime";
}

function inferStartsAt(task: IngestionTask, dateType: BucketItemDateType): string | undefined {
  if (dateType !== "scheduled") {
    return undefined;
  }

  const createdAt = new Date(task.createdAt);
  createdAt.setHours(createdAt.getHours() + 6);
  return createdAt.toISOString();
}

function deriveConfidence(task: IngestionTask): number {
  let score = 0.66;

  if (task.sourceUrl) {
    score += 0.1;
  }
  if (task.text) {
    score += 0.12;
  }
  if (task.screenshotName) {
    score += 0.04;
  }
  if (task.sourceType === "manual") {
    score += 0.04;
  }

  return Math.min(0.96, Number(score.toFixed(2)));
}

function estimatePrice(category: BucketCategory): string {
  switch (category) {
    case "culture":
      return "Free-£";
    case "cafe":
      return "£";
    case "market":
      return "£-££";
    case "nightlife":
      return "£££";
    case "eats":
    case "drinks":
    case "activity":
      return "££";
    case "hidden_gem":
    case "other":
    default:
      return "££";
  }
}

function estimateCost(category: BucketCategory, budgetMax = 30): number {
  switch (category) {
    case "culture":
      return Math.min(15, budgetMax);
    case "cafe":
      return Math.min(12, budgetMax);
    case "market":
      return Math.min(22, budgetMax);
    case "nightlife":
      return Math.max(28, Math.round(budgetMax * 1.1));
    case "activity":
      return Math.min(32, Math.max(20, budgetMax));
    case "eats":
    case "drinks":
    case "hidden_gem":
    case "other":
    default:
      return Math.min(30, Math.max(18, budgetMax));
  }
}

function matchesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
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
    priceEstimate: row.price_estimate,
    estimatedCost: row.estimated_cost,
    openingHours: row.opening_hours ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sourceType: row.source_type as SourcePlatform,
    tags: row.tags ?? [],
    confidence: row.confidence,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 25;
  }

  return Math.max(1, Math.min(100, Math.floor(limit)));
}

export type { BackendStore, DrainQueueResult, StoreMode };
