import type { BucketCategory } from "@/lib/domain";

export type CategoryMeta = {
  name: string;
  plural: string;
  emoji: string;
  sticker?: string;
  rotation: number;
};

export const CATEGORY_META: Record<BucketCategory, CategoryMeta> = {
  cafe:       { name: "Café",       plural: "Cafés",       emoji: "☕", sticker: "cafe",       rotation:  2 },
  restaurant: { name: "Restaurant", plural: "Restaurants", emoji: "🍽️", sticker: "restaurant", rotation: -2 },
  nightlife:  { name: "Nightlife",  plural: "Nightlife",   emoji: "🎉", sticker: "nightlife",  rotation: -4 },
  activity:   { name: "Activity",   plural: "Activities",  emoji: "🏃", sticker: "activity",   rotation:  3 },
  culture:    { name: "Culture",    plural: "Culture",     emoji: "🏛️", sticker: "culture",    rotation: -2 },
  shopping:   { name: "Shopping",   plural: "Shopping",    emoji: "🛍️", sticker: "shopping",   rotation:  3 },
};

export function derivePriceTier(estimatedCost: number): "$" | "$$" | "$$$" {
  if (estimatedCost < 15) return "$";
  if (estimatedCost <= 30) return "$$";
  return "$$$";
}
