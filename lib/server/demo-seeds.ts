import type { CapturePayload } from "@/lib/domain";
import type { ManualBucketItemInput } from "@/lib/server/validation";

// Demo seeds: when a specific capture is shared (matched by sourceUrl), the
// capture API short-circuits the live extraction/enrichment pipeline and inserts
// a hand-curated, fully-enriched bucket item instead. This keeps demos reliable
// regardless of the live TikTok/Instagram enrichment quality.
type DemoSeed = {
  /** Lowercased substrings of the capture sourceUrl that trigger this seed. */
  matchUrlIncludes: string[];
  /** Builds the bucket item to insert for the matched capture. */
  buildItem: (payload: CapturePayload) => ManualBucketItemInput;
};

const DEMO_SEEDS: DemoSeed[] = [
  {
    // Jeff's demo TikTok for the Georgian spot "DakaDaka"
    // (https://vm.tiktok.com/ZNRvfBsfa/). Edit the details below for the demo.
    matchUrlIncludes: ["znrvfbsfa"],
    buildItem: (payload) => ({
      userId: payload.userId,
      status: "saved",
      dateType: "anytime",
      title: "DakaDaka",
      category: "restaurant",
      description:
        "Buzzy Georgian restaurant in central London serving khinkali (soup dumplings), kebabi, khachapuri and octopus rice in a lively, casual setting.",
      whyInteresting:
        "A viral London Georgian spot loved for its khinkali and big-flavour sharing plates — a fun group dinner straight off your TikTok feed.",
      locationName: "DakaDaka, Marylebone",
      neighborhood: "Marylebone",
      address: "Marylebone, London",
      priceEstimate: "$$",
      estimatedCost: 30,
      openingHours: "Mon–Sun 12:00–23:00",
      websiteUrl: "https://www.instagram.com/dakadaka.london/",
      enrichmentProvider: "perplexity",
      enrichmentStatus: "complete",
      enrichmentSourceLinks: ["https://www.instagram.com/dakadaka.london/"],
      tags: ["georgian", "khinkali", "marylebone", "viral", "dinner"],
      confidence: 0.92,
      sourceType: payload.sourceType,
      sourceUrl: payload.sourceUrl
    })
  }
];

/** Returns the demo seed matching this capture, or null to run the normal pipeline. */
export function matchDemoSeed(payload: CapturePayload): DemoSeed | null {
  const url = (payload.sourceUrl ?? "").toLowerCase();
  if (!url) {
    return null;
  }
  return DEMO_SEEDS.find((seed) => seed.matchUrlIncludes.some((needle) => url.includes(needle))) ?? null;
}
