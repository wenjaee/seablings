import type { CapturePayload, SourcePlatform } from "@/lib/domain";
import type { ManualBucketItemInput } from "@/lib/server/validation";

// Demo seeds: when a matched capture is shared, the capture API short-circuits
// the live extraction/enrichment pipeline and inserts a hand-curated, fully
// enriched bucket item instead. This keeps demos reliable and instant.
type DemoSeed = {
  /** Match by capture source type (e.g. any TikTok). */
  matchSourceTypes?: SourcePlatform[];
  /** Match by lowercased substrings of the capture sourceUrl. */
  matchUrlIncludes?: string[];
  /** Builds the bucket item to insert for the matched capture. */
  buildItem: (payload: CapturePayload) => ManualBucketItemInput;
};

const DEMO_SEEDS: DemoSeed[] = [
  {
    // DakaDaka demo. NOTE: vm.tiktok.com short links are generated fresh on every
    // share, so we match ANY TikTok rather than a fixed code. (For the demo Jeff
    // only shares the DakaDaka TikTok.) Edit the details below as needed.
    matchSourceTypes: ["tiktok"],
    buildItem: (payload) => ({
      userId: payload.userId,
      status: "saved",
      dateType: "anytime",
      title: "DakaDaka",
      category: "restaurant",
      description:
        "Buzzy modern Georgian restaurant in Mayfair serving khinkali (soup dumplings), kebabi, khachapuri and octopus rice in a lively, design-led room.",
      whyInteresting:
        "A viral London Georgian spot loved for its khinkali and big-flavour sharing plates — a fun group dinner straight off your TikTok feed.",
      locationName: "DakaDaka, Mayfair",
      neighborhood: "Mayfair",
      address: "Mayfair, London",
      priceEstimate: "$$",
      estimatedCost: 35,
      openingHours: "Mon–Sun 12:00–23:00",
      websiteUrl: "https://www.instagram.com/dakadaka.london/",
      photoUrl: "https://www.hot-dinners.com/images/stories/blog/2026/daka/inside1.jpg",
      photoSourceLinks: ["https://www.hot-dinners.com/"],
      enrichmentProvider: "perplexity",
      enrichmentStatus: "complete",
      enrichmentSourceLinks: [
        "https://www.instagram.com/dakadaka.london/",
        "https://www.hot-dinners.com/"
      ],
      tags: ["georgian", "khinkali", "mayfair", "viral", "dinner"],
      confidence: 0.95,
      sourceType: payload.sourceType,
      sourceUrl: payload.sourceUrl
    })
  }
];

/** Returns the demo seed matching this capture, or null to run the normal pipeline. */
export function matchDemoSeed(payload: CapturePayload): DemoSeed | null {
  const sourceUrl = (payload.sourceUrl ?? "").toLowerCase();
  return (
    DEMO_SEEDS.find((seed) => {
      if (seed.matchSourceTypes?.includes(payload.sourceType)) {
        return true;
      }
      return Boolean(sourceUrl) && (seed.matchUrlIncludes?.some((needle) => sourceUrl.includes(needle)) ?? false);
    }) ?? null
  );
}
