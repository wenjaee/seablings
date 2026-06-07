import { bucketCategoryValues, type BucketCategory } from "@/lib/domain";

export const PLACE_CATEGORIES = bucketCategoryValues;

export type PlaceCategory = BucketCategory;

const PLACE_CATEGORY_SET = new Set<PlaceCategory>(PLACE_CATEGORIES);

const CATEGORY_ALIASES: Record<string, PlaceCategory> = {
  bakery: "bakery",
  bakehouse: "bakery",
  pastry: "bakery",
  pastries: "bakery",
  patisserie: "bakery",
  cafe: "cafe",
  coffee: "cafe",
  coffeeshop: "cafe",
  coffee_shop: "cafe",
  coffeehouse: "cafe",
  brunch: "cafe",
  restaurant: "restaurant",
  eatery: "restaurant",
  dining: "restaurant",
  food: "restaurant",
  eats: "restaurant",
  bar: "bar",
  pub: "bar",
  drinks: "bar",
  cocktail: "bar",
  cocktails: "bar",
  nightlife: "nightlife",
  club: "nightlife",
  late_night: "nightlife",
  "late-night": "nightlife",
  activity: "activity",
  activities: "activity",
  fitness: "activity",
  sport: "activity",
  sports: "activity",
  culture: "culture",
  museum: "culture",
  gallery: "culture",
  art: "culture",
  shopping: "shopping",
  market: "shopping",
  retail: "shopping",
  store: "shopping",
  shop: "shopping",
  hidden_gem: "other",
  "hidden-gem": "other",
  other: "other"
};

const CATEGORY_KEYWORDS: Array<{ category: PlaceCategory; patterns: RegExp[] }> = [
  { category: "bakery", patterns: [/\bbakery\b/i, /\bpastr(y|ies)\b/i, /\bbread\b/i, /\bpatisserie\b/i] },
  {
    category: "cafe",
    patterns: [/\bcafe\b/i, /\bcoffee\b/i, /\bespresso\b/i, /\bbrunch\b/i, /\bmatcha\b/i, /\blatte\b/i]
  },
  {
    category: "restaurant",
    patterns: [/\brestaurant\b/i, /\bdinner\b/i, /\blunch\b/i, /\bmeal\b/i, /\bfood\b/i, /\beatery\b/i]
  },
  { category: "bar", patterns: [/\bbar\b/i, /\bpub\b/i, /\bcocktail\b/i, /\bwine\b/i, /\bbeer\b/i] },
  { category: "nightlife", patterns: [/\bclub\b/i, /\bdj\b/i, /\blate[- ]night\b/i, /\bparty\b/i, /\blive music\b/i] },
  {
    category: "activity",
    patterns: [/\bworkshop\b/i, /\bclass\b/i, /\bhike\b/i, /\bclimb\b/i, /\bgame\b/i, /\bactivity\b/i]
  },
  {
    category: "culture",
    patterns: [/\bmuseum\b/i, /\bgallery\b/i, /\bexhibit\b/i, /\bart\b/i, /\bculture\b/i, /\btheatre\b/i]
  },
  {
    category: "shopping",
    patterns: [/\bshop(ping)?\b/i, /\bmarket\b/i, /\bboutique\b/i, /\bstore\b/i, /\bpop-up\b/i]
  }
];

export function normalizePlaceCategory(value: unknown, fallback: PlaceCategory = "other"): PlaceCategory {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (PLACE_CATEGORY_SET.has(normalized as PlaceCategory)) {
    return normalized as PlaceCategory;
  }

  return CATEGORY_ALIASES[normalized] ?? fallback;
}

export function inferPlaceCategory(text: string, fallback: PlaceCategory = "other"): PlaceCategory {
  for (const candidate of CATEGORY_KEYWORDS) {
    if (candidate.patterns.some((pattern) => pattern.test(text))) {
      return candidate.category;
    }
  }

  return fallback;
}

export function normalizePlaceTags(tags: unknown, seed: string[] = []): string[] {
  const merged = [...toTagStrings(tags), ...seed.flatMap((value) => toTagStrings([value]))];
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const candidate of merged) {
    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    deduped.push(candidate);

    if (deduped.length === 5) {
      break;
    }
  }

  while (deduped.length < 3) {
    const filler = DEFAULT_TAG_FILLERS[deduped.length] ?? "local";
    if (!seen.has(filler)) {
      seen.add(filler);
      deduped.push(filler);
      continue;
    }

    break;
  }

  return deduped.slice(0, 5);
}

export function normalizeConfidence(value: unknown, fallback = 0.65): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function toTagStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .map((item) => item.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter((item) => item.length >= 2 && item.length <= 24);
}

const DEFAULT_TAG_FILLERS = ["trending", "save-worthy", "local"] as const;
