import type { BucketCategory } from "@/lib/domain";

export type CategoryMeta = {
  name: string;
  emoji: string;
  sticker?: string;
  rotation: number;
};

export const CATEGORY_META: Record<BucketCategory, CategoryMeta> = {
  bakery:     { name: "Bakery",     emoji: "🥐", sticker: "bakery",     rotation: -3 },
  cafe:       { name: "Café",       emoji: "☕", sticker: "cafe",       rotation:  2 },
  restaurant: { name: "Restaurant", emoji: "🍽️", sticker: "restaurant", rotation: -2 },
  bar:        { name: "Bar",        emoji: "🍺", sticker: "bar",        rotation:  4 },
  nightlife:  { name: "Nightlife",  emoji: "🎉", sticker: "nightlife",  rotation: -4 },
  activity:   { name: "Activity",   emoji: "🏃", sticker: "activity",   rotation:  3 },
  culture:    { name: "Culture",    emoji: "🏛️", sticker: "culture",    rotation: -2 },
  shopping:   { name: "Shopping",   emoji: "🛍️", sticker: "shopping",   rotation:  3 },
  other:      { name: "Other",      emoji: "🗺️", sticker: "other",      rotation: -3 },
};

export function derivePriceTier(estimatedCost: number): "$" | "$$" | "$$$" {
  if (estimatedCost < 15) return "$";
  if (estimatedCost <= 30) return "$$";
  return "$$$";
}
