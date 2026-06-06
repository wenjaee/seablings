import type { BucketCategory } from "@/lib/domain";

export type CategoryMeta = {
  name: string;
  emoji: string;
};

export const CATEGORY_META: Record<BucketCategory, CategoryMeta> = {
  bakery:     { name: "Bakery",     emoji: "🥐" },
  cafe:       { name: "Café",       emoji: "☕" },
  restaurant: { name: "Restaurant", emoji: "🍽️" },
  bar:        { name: "Bar",        emoji: "🍺" },
  nightlife:  { name: "Nightlife",  emoji: "🎉" },
  activity:   { name: "Activity",   emoji: "🏃" },
  culture:    { name: "Culture",    emoji: "🏛️" },
  shopping:   { name: "Shopping",   emoji: "🛍️" },
  other:      { name: "Other",      emoji: "🗺️" },
};

export function derivePriceTier(estimatedCost: number): "$" | "$$" | "$$$" {
  if (estimatedCost < 15) return "$";
  if (estimatedCost <= 30) return "$$";
  return "$$$";
}
