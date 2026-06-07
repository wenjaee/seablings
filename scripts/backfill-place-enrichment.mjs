#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const SCRIPT_NAME = "backfill-place-enrichment";
const SCRIPT_PATH = "scripts/backfill-place-enrichment.mjs";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const CATEGORY_MAPPINGS = {
  eats: "restaurant",
  drinks: "bar",
  hidden_gem: "other",
  market: "shopping"
};

const PRD_CATEGORIES = new Set([
  "bakery",
  "cafe",
  "restaurant",
  "bar",
  "nightlife",
  "activity",
  "culture",
  "shopping",
  "other"
]);

const PRICE_TIERS = new Set(["$", "$$", "$$$"]);

const SOURCE_TYPE_TAGS = new Set(["tiktok", "instagram", "screenshot", "manual", "text"]);
const INTERNAL_TAGS = new Set([
  "candidate",
  "saved",
  "completed",
  "rejected",
  "archived",
  "extracting",
  "enriching",
  "embedding",
  "enrichment",
  "enriched",
  "extraction",
  "extracted",
  "ai-ingested",
  "gemini-extracted",
  "perplexity-enriched",
  "provider-enriched",
  "gemini",
  "perplexity",
  "fixture",
  "fallback",
  "provider",
  "system"
]);

const SYSTEM_TAGS = new Set([...SOURCE_TYPE_TAGS, ...INTERNAL_TAGS, ...PRD_CATEGORIES]);

const BASE_BUCKET_ITEM_COLUMNS = [
  "id",
  "user_id",
  "status",
  "date_type",
  "title",
  "category",
  "description",
  "why_interesting",
  "location_name",
  "neighborhood",
  "address",
  "postal_code",
  "price_estimate",
  "estimated_cost",
  "opening_hours",
  "website_url",
  "source_url",
  "source_type",
  "tags",
  "confidence",
  "created_at",
  "updated_at"
];

const OPTIONAL_METADATA_COLUMNS = [
  "enrichment_provider",
  "enrichment_status",
  "enrichment_source_links",
  "enrichment_confidence_note"
];

const REQUIRED_ENRICHMENT_FIELDS = [
  "description",
  "why_interesting",
  "location_name",
  "neighborhood",
  "price_estimate",
  "tags",
  "confidence"
];

const PROVIDER_DETAIL_FIELDS = ["address", "postal_code", "opening_hours", "website_url"];
const PLACEHOLDER_TEXT_VALUES = new Set(["unknown", "n/a", "na", "none", "null", "todo", "tbd"]);

main().catch((error) => {
  console.error(`Backfill failed: ${redact(String(error?.message ?? error))}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const envFile = loadDotEnvLocal();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Add them to .env.local or the shell environment.");
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const bucketItemsTable = await detectTable(client, "bucket_items");
  if (!bucketItemsTable.exists) {
    throw new Error(`bucket_items table is missing or inaccessible: ${bucketItemsTable.error ?? "unknown error"}`);
  }

  const metadataColumns = await detectOptionalColumns(client, "bucket_items", OPTIONAL_METADATA_COLUMNS);
  const rows = await fetchBucketItems(client, options, metadataColumns.present);
  const embeddings = await fetchEmbeddingState(client, rows.map((row) => row.id));

  const analyses = rows.map((row) => analyzeRow(row, metadataColumns.present, embeddings.presentIds.has(row.id)));
  const applyResults = options.apply ? await applyPatches(client, analyses) : [];
  const summary = buildSummary({
    envFile,
    options,
    rows,
    analyses,
    embeddings,
    metadataColumns,
    applyResults
  });

  printHumanSummary(summary);
  console.log("JSON summary:");
  console.log(JSON.stringify(summary, null, 2));
}

function parseArgs(argv) {
  let dryRunExplicit = false;
  const options = {
    apply: false,
    dryRun: true,
    limit: DEFAULT_LIMIT,
    status: undefined,
    sourceUrl: undefined,
    userId: undefined,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
      options.dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRunExplicit = true;
      options.dryRun = true;
      continue;
    }

    const [name, inlineValue] = arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    if (name === "--user-id") {
      options.userId = readArgValue(name, inlineValue, () => {
        index += 1;
        return argv[index];
      });
      continue;
    }
    if (name === "--source-url") {
      options.sourceUrl = readArgValue(name, inlineValue, () => {
        index += 1;
        return argv[index];
      });
      continue;
    }
    if (name === "--status") {
      options.status = readArgValue(name, inlineValue, () => {
        index += 1;
        return argv[index];
      });
      continue;
    }
    if (name === "--limit") {
      const rawLimit = readArgValue(name, inlineValue, () => {
        index += 1;
        return argv[index];
      });
      const limit = Number.parseInt(rawLimit, 10);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}.`);
      }
      options.limit = limit;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.apply && dryRunExplicit) {
    throw new Error("Use either --apply or --dry-run, not both.");
  }

  return options;
}

function readArgValue(name, inlineValue, readNext) {
  if (inlineValue !== undefined) {
    if (inlineValue.length === 0) {
      throw new Error(`${name} requires a value.`);
    }
    return inlineValue;
  }

  const value = readNext();
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

function printHelp() {
  console.log(`Usage: node ${SCRIPT_PATH} [--dry-run] [--apply] [--user-id USER] [--source-url URL] [--status STATUS] [--limit N]`);
  console.log("");
  console.log("Default mode is dry-run. --apply mutates only deterministic category, price, tag, and metadata defaults.");
}

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return { loaded: false, path: ".env.local" };
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = parseDotEnvValue(rawValue);
  }

  return { loaded: true, path: ".env.local" };
}

function parseDotEnvValue(rawValue) {
  let value = rawValue.trim();
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, "\"");
  } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }

  return value;
}

async function detectTable(client, table) {
  const { error } = await client.from(table).select("*", { count: "exact", head: true });
  if (!error) {
    return { exists: true };
  }

  return {
    exists: false,
    error: summarizeSupabaseError(error)
  };
}

async function detectOptionalColumns(client, table, columns) {
  const present = [];
  const missing = [];
  const errors = {};

  for (const column of columns) {
    const { error } = await client.from(table).select(column).limit(1);
    if (!error) {
      present.push(column);
      continue;
    }

    if (isMissingColumnError(error, column)) {
      missing.push(column);
      continue;
    }

    missing.push(column);
    errors[column] = summarizeSupabaseError(error);
  }

  return { present, missing, errors };
}

async function fetchBucketItems(client, options, optionalColumns) {
  const selectColumns = [...BASE_BUCKET_ITEM_COLUMNS, ...optionalColumns].join(",");
  let query = client.from("bucket_items").select(selectColumns).order("updated_at", { ascending: false }).limit(options.limit);

  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }
  if (options.sourceUrl) {
    query = query.eq("source_url", options.sourceUrl);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch bucket_items: ${summarizeSupabaseError(error)}`);
  }

  return data ?? [];
}

async function fetchEmbeddingState(client, itemIds) {
  const table = await detectTable(client, "bucket_item_embeddings");
  const presentIds = new Set();

  if (!table.exists || itemIds.length === 0) {
    return {
      table,
      presentIds,
      missingIds: table.exists ? [] : itemIds
    };
  }

  const { data, error } = await client
    .from("bucket_item_embeddings")
    .select("bucket_item_id")
    .in("bucket_item_id", itemIds);

  if (error) {
    return {
      table: { exists: false, error: summarizeSupabaseError(error) },
      presentIds,
      missingIds: itemIds
    };
  }

  for (const row of data ?? []) {
    if (typeof row.bucket_item_id === "string") {
      presentIds.add(row.bucket_item_id);
    }
  }

  return {
    table,
    presentIds,
    missingIds: itemIds.filter((id) => !presentIds.has(id))
  };
}

function analyzeRow(row, optionalColumns, hasEmbedding) {
  const category = normalizeCategory(row.category, row);
  const price = normalizePriceTier(row.price_estimate);
  const tags = cleanTags(row.tags, row);
  const missingFields = findMissingEnrichmentFields(row, tags.cleaned);
  const providerReenrichmentNeeded = missingFields.length > 0 || !hasEmbedding;
  const sourceLinks = normalizeSourceLinks([row.source_url, row.website_url]);
  const patch = {};
  const changes = [];

  if (category.changed) {
    patch.category = category.value;
    changes.push({
      type: "category",
      from: row.category,
      to: category.value,
      reason: category.reason
    });
  }

  if (price.changed) {
    patch.price_estimate = price.value;
    changes.push({
      type: "price_estimate",
      from: row.price_estimate,
      to: price.value,
      reason: price.reason
    });
  }

  if (tags.changed) {
    patch.tags = tags.cleaned;
    changes.push({
      type: "tags",
      from: tags.original,
      to: tags.cleaned,
      removedSystemTags: tags.removedSystemTags,
      removedInvalidTags: tags.removedInvalidTags
    });
  }

  if (optionalColumns.includes("enrichment_provider") && isBlank(row.enrichment_provider)) {
    patch.enrichment_provider = "backfill";
    changes.push({
      type: "enrichment_provider",
      from: row.enrichment_provider ?? null,
      to: patch.enrichment_provider,
      reason: "deterministic-backfill"
    });
  }

  if (optionalColumns.includes("enrichment_status") && isBlank(row.enrichment_status)) {
    patch.enrichment_status = providerReenrichmentNeeded ? "partial" : "complete";
    changes.push({
      type: "enrichment_status",
      from: row.enrichment_status ?? null,
      to: patch.enrichment_status,
      reason: providerReenrichmentNeeded ? "missing-provider-fields-or-embedding" : "complete-after-normalization"
    });
  }

  if (optionalColumns.includes("enrichment_source_links") && isBlank(row.enrichment_source_links) && sourceLinks.length > 0) {
    patch.enrichment_source_links = sourceLinks;
    changes.push({
      type: "enrichment_source_links",
      from: row.enrichment_source_links ?? null,
      to: patch.enrichment_source_links,
      reason: "source-url-or-website"
    });
  }

  if (optionalColumns.includes("enrichment_confidence_note") && isBlank(row.enrichment_confidence_note) && providerReenrichmentNeeded) {
    const missingSummary = missingFields.length > 0 ? `Missing fields: ${missingFields.join(", ")}.` : "";
    const embeddingSummary = hasEmbedding ? "" : "Missing embedding.";
    patch.enrichment_confidence_note = [missingSummary, embeddingSummary, "Deterministic cleanup only; provider re-enrichment not run."]
      .filter(Boolean)
      .join(" ");
    changes.push({
      type: "enrichment_confidence_note",
      from: row.enrichment_confidence_note ?? null,
      to: patch.enrichment_confidence_note,
      reason: "provider-reenrichment-needed"
    });
  }

  return {
    id: row.id,
    title: row.title,
    userId: row.user_id,
    status: row.status,
    sourceUrl: row.source_url,
    hasEmbedding,
    missingEmbedding: !hasEmbedding,
    missingEnrichmentFields: missingFields,
    providerReenrichmentNeeded,
    changes,
    patch
  };
}

function normalizeCategory(value, row) {
  if (typeof value !== "string") {
    return { changed: false, value, reason: "not-string" };
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const inferred = inferCategoryFromRow(row);

  if ((CATEGORY_MAPPINGS[normalized] || normalized === "other") && inferred && inferred !== CATEGORY_MAPPINGS[normalized]) {
    return {
      changed: inferred !== value,
      value: inferred,
      reason: "row-content-inference"
    };
  }

  const mapped = CATEGORY_MAPPINGS[normalized];
  if (mapped) {
    return {
      changed: mapped !== value,
      value: mapped,
      reason: "old-category-map"
    };
  }

  if (PRD_CATEGORIES.has(normalized)) {
    return {
      changed: normalized !== value,
      value: normalized,
      reason: "canonical-category"
    };
  }

  return { changed: false, value, reason: "unknown-category" };
}

function inferCategoryFromRow(row) {
  const text = [
    row.title,
    row.category,
    row.description,
    row.why_interesting,
    ...parseTags(row.tags)
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (/\b(bakery|bakehouse|patisserie|pastry|pastries|bread|dessert|panettone|babka)\b/.test(text)) {
    return "bakery";
  }

  if (/\b(cafe|coffee|espresso|matcha|brunch|tea)\b/.test(text)) {
    return "cafe";
  }

  if (/\b(bar|pub|cocktail|cocktails|wine|beer|drinks)\b/.test(text)) {
    return "bar";
  }

  if (/\b(club|nightlife|dj|party|late-night|late night)\b/.test(text)) {
    return "nightlife";
  }

  if (/\b(gallery|museum|art|culture|historic|landmark|heritage|square|park)\b/.test(text)) {
    return "culture";
  }

  if (/\b(shop|shopping|market|boutique|store|fashion|vintage|concept-store|concept store)\b/.test(text)) {
    return "shopping";
  }

  if (/\b(workshop|class|sport|padel|activity|experience|walk|street|tour)\b/.test(text)) {
    return "activity";
  }

  if (/\b(restaurant|dinner|lunch|meal|food|eatery|izakaya|bistro)\b/.test(text)) {
    return "restaurant";
  }

  return null;
}

function normalizePriceTier(value) {
  const original = typeof value === "string" ? value.trim() : "";
  if (PRICE_TIERS.has(original)) {
    return { changed: false, value: original, reason: "already-tier" };
  }

  const lower = original.toLowerCase();
  let normalized = "$$";
  let reason = "default-mid-tier";

  if (!original) {
    reason = "missing-default";
  } else if (/\b(free|gratis|no cost)\b/i.test(original)) {
    normalized = "$";
    reason = "free-to-low-tier";
  } else {
    const currencyGroups = original.match(/[$£€¥]{1,3}/g);
    if (currencyGroups?.length) {
      const width = Math.max(...currencyGroups.map((group) => Math.min(group.length, 3)));
      normalized = "$".repeat(width);
      reason = "currency-symbol-tier";
    } else if (/\b(cheap|budget|affordable|low|under)\b/i.test(original)) {
      normalized = "$";
      reason = "low-cost-word";
    } else if (/\b(luxury|expensive|premium|fine dining|splurge)\b/i.test(original)) {
      normalized = "$$$";
      reason = "high-cost-word";
    } else if (/\b(moderate|mid|average|standard)\b/i.test(original)) {
      normalized = "$$";
      reason = "mid-cost-word";
    } else {
      const numbers = [...lower.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number.parseFloat(match[0]));
      if (numbers.length > 0) {
        const max = Math.max(...numbers);
        if (max <= 20) {
          normalized = "$";
        } else if (max <= 75) {
          normalized = "$$";
        } else {
          normalized = "$$$";
        }
        reason = "numeric-cost-tier";
      }
    }
  }

  return {
    changed: normalized !== value,
    value: normalized,
    reason
  };
}

function cleanTags(value, row) {
  const original = parseTags(value);
  const cleaned = [];
  const seen = new Set();
  const removedSystemTags = [];
  const removedInvalidTags = [];

  for (const rawTag of original) {
    const tag = normalizeTag(rawTag);
    if (!tag) {
      removedInvalidTags.push(String(rawTag));
      continue;
    }

    if (isSystemTag(tag)) {
      removedSystemTags.push(tag);
      continue;
    }

    if (seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    cleaned.push(tag);
  }

  for (const fallbackTag of buildFallbackTags(row)) {
    if (cleaned.length >= 3) {
      break;
    }

    if (seen.has(fallbackTag) || isSystemTag(fallbackTag)) {
      continue;
    }

    seen.add(fallbackTag);
    cleaned.push(fallbackTag);
  }

  return {
    original,
    cleaned: cleaned.slice(0, 5),
    removedSystemTags,
    removedInvalidTags,
    changed: !arraysEqual(original, cleaned.slice(0, 5))
  };
}

function isSystemTag(tag) {
  return SYSTEM_TAGS.has(tag) || /(^|[-_])(ingested|enriched|extracted)$/.test(tag);
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeTag(value) {
  const tag = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (tag.length < 2 || tag.length > 24) {
    return "";
  }

  return tag;
}

function buildFallbackTags(row) {
  const text = [row.title, row.neighborhood, row.description, row.why_interesting]
    .filter((value) => typeof value === "string")
    .join(" ");
  const tags = [];
  const seen = new Set();

  for (const word of text.split(/[^a-z0-9]+/i)) {
    const tag = normalizeTag(word);
    if (!tag || seen.has(tag) || isSystemTag(tag)) {
      continue;
    }

    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 5) {
      break;
    }
  }

  for (const fallback of ["local", "visit", "save"]) {
    if (!seen.has(fallback)) {
      tags.push(fallback);
      seen.add(fallback);
    }
    if (tags.length >= 5) {
      break;
    }
  }

  return tags;
}

function findMissingEnrichmentFields(row, cleanedTags) {
  const missing = [];

  for (const field of REQUIRED_ENRICHMENT_FIELDS) {
    if (field === "tags") {
      if (cleanedTags.length === 0) {
        missing.push(field);
      }
      continue;
    }

    if (field === "confidence") {
      if (typeof row.confidence !== "number" || !Number.isFinite(row.confidence)) {
        missing.push(field);
      }
      continue;
    }

    if (!hasUsableText(row[field])) {
      missing.push(field);
    }
  }

  for (const field of PROVIDER_DETAIL_FIELDS) {
    if (!hasUsableText(row[field])) {
      missing.push(field);
    }
  }

  return missing;
}

function hasUsableText(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return !PLACEHOLDER_TEXT_VALUES.has(trimmed.toLowerCase());
}

function normalizeSourceLinks(value) {
  const source = Array.isArray(value) ? value : [value];
  const links = [];
  const seen = new Set();

  for (const candidate of source) {
    if (typeof candidate !== "string") {
      continue;
    }

    try {
      const url = new URL(candidate.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        continue;
      }

      const href = url.toString();
      if (seen.has(href)) {
        continue;
      }

      seen.add(href);
      links.push(href);
    } catch {
      continue;
    }
  }

  return links.slice(0, 6);
}

async function applyPatches(client, analyses) {
  const results = [];

  for (const analysis of analyses) {
    if (Object.keys(analysis.patch).length === 0) {
      results.push({ id: analysis.id, applied: false, skipped: "no_changes" });
      continue;
    }

    const { error } = await client.from("bucket_items").update(analysis.patch).eq("id", analysis.id);
    if (error) {
      results.push({
        id: analysis.id,
        applied: false,
        error: summarizeSupabaseError(error)
      });
      continue;
    }

    results.push({
      id: analysis.id,
      applied: true,
      updatedColumns: Object.keys(analysis.patch)
    });
  }

  return results;
}

function buildSummary({ envFile, options, rows, analyses, embeddings, metadataColumns, applyResults }) {
  const categoryMappings = {};
  const priceNormalizations = {};
  const systemTagsRemoved = {};
  const missingEnrichmentFields = {};

  for (const oldCategory of Object.keys(CATEGORY_MAPPINGS)) {
    categoryMappings[oldCategory] = {
      to: CATEGORY_MAPPINGS[oldCategory],
      count: 0
    };
  }

  for (const analysis of analyses) {
    for (const change of analysis.changes) {
      if (change.type === "category") {
        const key = normalizeCategoryKey(change.from);
        if (categoryMappings[key]) {
          categoryMappings[key].count += 1;
        }
      }

      if (change.type === "price_estimate") {
        const key = String(change.from ?? "");
        priceNormalizations[key] ??= { to: change.to, count: 0 };
        priceNormalizations[key].count += 1;
      }

      if (change.type === "tags") {
        for (const tag of change.removedSystemTags) {
          systemTagsRemoved[tag] = (systemTagsRemoved[tag] ?? 0) + 1;
        }
      }
    }

    for (const field of analysis.missingEnrichmentFields) {
      missingEnrichmentFields[field] = (missingEnrichmentFields[field] ?? 0) + 1;
    }
  }

  const failedApplyResults = applyResults.filter((result) => result.error);
  const appliedResults = applyResults.filter((result) => result.applied);

  return {
    script: SCRIPT_PATH,
    mode: options.apply ? "apply" : "dry-run",
    dryRun: !options.apply,
    env: {
      envFileLoaded: envFile.loaded,
      envFilePath: envFile.path,
      secretsPrinted: false
    },
    filters: {
      userId: options.userId ?? null,
      sourceUrl: options.sourceUrl ?? null,
      status: options.status ?? null,
      limit: options.limit
    },
    tables: {
      bucketItems: { exists: true },
      bucketItemEmbeddings: embeddings.table
    },
    optionalMetadataColumns: metadataColumns,
    counts: {
      scanned: rows.length,
      wouldUpdate: analyses.filter((analysis) => Object.keys(analysis.patch).length > 0).length,
      applied: appliedResults.length,
      applyFailed: failedApplyResults.length,
      categoryMappings: analyses.filter((analysis) => analysis.changes.some((change) => change.type === "category")).length,
      priceNormalizations: analyses.filter((analysis) => analysis.changes.some((change) => change.type === "price_estimate")).length,
      tagCleanups: analyses.filter((analysis) => analysis.changes.some((change) => change.type === "tags")).length,
      systemTagsRemoved: Object.values(systemTagsRemoved).reduce((total, count) => total + count, 0),
      rowsMissingEnrichmentFields: analyses.filter((analysis) => analysis.missingEnrichmentFields.length > 0).length,
      missingEmbeddings: embeddings.missingIds.length,
      providerReenrichmentNeeded: analyses.filter((analysis) => analysis.providerReenrichmentNeeded).length
    },
    categoryMappings,
    priceNormalizations,
    systemTagsRemoved,
    missingEnrichmentFields,
    missingEmbeddingIds: embeddings.missingIds,
    rows: analyses.map((analysis) => ({
      id: analysis.id,
      title: analysis.title,
      userId: analysis.userId,
      status: analysis.status,
      sourceUrl: analysis.sourceUrl,
      hasEmbedding: analysis.hasEmbedding,
      providerReenrichmentNeeded: analysis.providerReenrichmentNeeded,
      missingEnrichmentFields: analysis.missingEnrichmentFields,
      changes: analysis.changes,
      patch: analysis.patch
    })),
    applyResults
  };
}

function printHumanSummary(summary) {
  const prefix = `[${summary.mode}]`;
  console.log(`${prefix} scanned ${summary.counts.scanned} bucket_items rows with limit ${summary.filters.limit}.`);
  console.log(
    `${prefix} ${summary.dryRun ? "would update" : "updated"} ${summary.dryRun ? summary.counts.wouldUpdate : summary.counts.applied} rows; ` +
      `category mappings ${summary.counts.categoryMappings}, price normalizations ${summary.counts.priceNormalizations}, tag cleanups ${summary.counts.tagCleanups}.`
  );
  console.log(
    `${prefix} system tags removed ${summary.counts.systemTagsRemoved}; rows missing enrichment fields ${summary.counts.rowsMissingEnrichmentFields}; ` +
      `provider re-enrichment needed ${summary.counts.providerReenrichmentNeeded}.`
  );

  if (summary.tables.bucketItemEmbeddings.exists) {
    console.log(`${prefix} missing embeddings ${summary.counts.missingEmbeddings}.`);
  } else {
    console.log(`${prefix} bucket_item_embeddings table missing or inaccessible; embeddings could not be verified.`);
  }

  if (summary.optionalMetadataColumns.missing.length > 0) {
    console.log(`${prefix} optional metadata columns absent: ${summary.optionalMetadataColumns.missing.join(", ")}.`);
  }

  if (summary.counts.applyFailed > 0) {
    console.log(`${prefix} apply failures ${summary.counts.applyFailed}; see JSON summary for Supabase errors.`);
  }
}

function normalizeCategoryKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
}

function isBlank(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

function isMissingColumnError(error, column) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return error?.code === "PGRST204" || message.includes(`'${column.toLowerCase()}' column`) || message.includes(`column ${column.toLowerCase()}`);
}

function summarizeSupabaseError(error) {
  const parts = [error?.code, error?.message, error?.details, error?.hint]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  return redact(parts.join(" | ") || "unknown Supabase error");
}

function redact(text) {
  let redacted = text;
  for (const [key, value] of Object.entries(process.env)) {
    if (!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(key) || typeof value !== "string" || value.length < 6) {
      continue;
    }

    redacted = redacted.split(value).join("[redacted]");
  }

  return redacted;
}
