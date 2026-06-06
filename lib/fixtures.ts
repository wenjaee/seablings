import type { BucketItem, ChatMessage, Persona, PlanningCriteria, Recommendation } from "@/lib/domain";

export const personas: Persona[] = [
  {
    id: "jeff",
    name: "Jeff",
    color: "#0f766e",
    postalCode: "E1 6AN",
    defaultBudgetMax: 35
  },
  {
    id: "praya",
    name: "Praya",
    color: "#b04473",
    postalCode: "SW9 8JH",
    defaultBudgetMax: 28
  },
  {
    id: "tana",
    name: "Tana",
    color: "#5a7f36",
    postalCode: "N1C 4QP",
    defaultBudgetMax: 32
  }
];

export const seededBucketItems: BucketItem[] = [
  {
    id: "brat-live-share",
    userId: "jeff",
    status: "candidate",
    dateType: "anytime",
    title: "Brat",
    category: "eats",
    description: "Fire-cooked Basque-style restaurant that keeps showing up on food TikTok.",
    whyInteresting: "Strong live-capture proof item for Jeff's share-extension flow.",
    locationName: "Brat",
    neighborhood: "Shoreditch",
    address: "4 Redchurch St, London E1 6JL",
    postalCode: "E1 6JL",
    priceEstimate: "£££",
    estimatedCost: 45,
    openingHours: "Lunch and dinner",
    sourceUrl: "https://www.tiktok.com/@demo/video/brat",
    sourceType: "tiktok",
    tags: ["viral", "date", "food"],
    confidence: 0.91,
    createdAt: "2026-06-06T12:10:00Z",
    updatedAt: "2026-06-06T12:10:00Z"
  },
  {
    id: "dishoom-kings-cross",
    userId: "jeff",
    status: "saved",
    dateType: "anytime",
    title: "Dishoom King's Cross",
    category: "eats",
    description: "Reliable group-friendly Indian restaurant with a memorable queue and late breakfast angle.",
    whyInteresting: "Easy crowd-pleaser and a safe fallback if the group wants food.",
    locationName: "Dishoom King's Cross",
    neighborhood: "King's Cross",
    address: "5 Stable St, London N1C 4AB",
    postalCode: "N1C 4AB",
    priceEstimate: "££",
    estimatedCost: 30,
    openingHours: "Open daily",
    sourceType: "manual",
    tags: ["group", "reliable", "food"],
    confidence: 0.98,
    createdAt: "2026-06-06T11:48:00Z",
    updatedAt: "2026-06-06T11:48:00Z"
  },
  {
    id: "borough-market",
    userId: "praya",
    status: "saved",
    dateType: "anytime",
    title: "Borough Market",
    category: "market",
    description: "Classic food market with many options when the group cannot agree on one cuisine.",
    whyInteresting: "Solves vetoes because everyone can choose a different stall.",
    locationName: "Borough Market",
    neighborhood: "London Bridge",
    postalCode: "SE1 9AL",
    priceEstimate: "£-££",
    estimatedCost: 22,
    openingHours: "Best before late afternoon",
    sourceType: "instagram",
    tags: ["cheap", "group", "food"],
    confidence: 0.95,
    createdAt: "2026-06-06T11:36:00Z",
    updatedAt: "2026-06-06T11:36:00Z"
  },
  {
    id: "canova-hall",
    userId: "praya",
    status: "saved",
    dateType: "anytime",
    title: "Canova Hall",
    category: "drinks",
    description: "Brixton spot for drinks and casual food with enough energy for a group evening.",
    whyInteresting: "Good bridge between dinner and drinks without booking a formal meal.",
    locationName: "Canova Hall",
    neighborhood: "Brixton",
    postalCode: "SW9 8PU",
    priceEstimate: "££",
    estimatedCost: 28,
    openingHours: "Open late",
    sourceType: "tiktok",
    tags: ["group", "drinks", "casual"],
    confidence: 0.86,
    createdAt: "2026-06-06T11:40:00Z",
    updatedAt: "2026-06-06T11:40:00Z"
  },
  {
    id: "padel-social-club",
    userId: "praya",
    status: "saved",
    dateType: "scheduled",
    title: "Padel Social Club",
    category: "activity",
    description: "Activity-first option for a group that wants something more active than dinner.",
    whyInteresting: "High social payoff and easy to explain in a recommendation card.",
    locationName: "Padel Social Club",
    neighborhood: "Earls Court",
    postalCode: "SW6 1UD",
    priceEstimate: "££",
    estimatedCost: 30,
    openingHours: "Bookable courts",
    sourceType: "manual",
    tags: ["activity", "group", "sport"],
    confidence: 0.82,
    startsAt: "2026-06-07T15:00:00Z",
    createdAt: "2026-06-06T11:45:00Z",
    updatedAt: "2026-06-06T11:45:00Z"
  },
  {
    id: "tate-modern",
    userId: "tana",
    status: "saved",
    dateType: "anytime",
    title: "Tate Modern",
    category: "culture",
    description: "Low-cost culture fallback with river walk potential before or after.",
    whyInteresting: "Cheap, central, and works even when food budgets do not line up.",
    locationName: "Tate Modern",
    neighborhood: "Bankside",
    postalCode: "SE1 9TG",
    priceEstimate: "Free-£",
    estimatedCost: 12,
    openingHours: "Open daytime",
    sourceType: "screenshot",
    tags: ["cheap", "culture", "walk"],
    confidence: 0.94,
    createdAt: "2026-06-06T11:20:00Z",
    updatedAt: "2026-06-06T11:20:00Z"
  },
  {
    id: "gods-own-junkyard",
    userId: "tana",
    status: "saved",
    dateType: "anytime",
    title: "Gods Own Junkyard",
    category: "hidden_gem",
    description: "Neon gallery and cafe that photographs well and feels discovery-led.",
    whyInteresting: "Strong aesthetic social payoff for a group weekend plan.",
    locationName: "Gods Own Junkyard",
    neighborhood: "Walthamstow",
    postalCode: "E17 9HQ",
    priceEstimate: "£",
    estimatedCost: 18,
    openingHours: "Weekend-friendly",
    sourceType: "instagram",
    tags: ["aesthetic", "hidden gem", "culture"],
    confidence: 0.9,
    createdAt: "2026-06-06T11:25:00Z",
    updatedAt: "2026-06-06T11:25:00Z"
  },
  {
    id: "fabric",
    userId: "tana",
    status: "saved",
    dateType: "one_off",
    title: "Fabric Friday",
    category: "nightlife",
    description: "Nightlife option if the group wants a late plan and budget can stretch.",
    whyInteresting: "Good contrast recommendation for a more energetic group mood.",
    locationName: "Fabric",
    neighborhood: "Farringdon",
    postalCode: "EC1M 6HJ",
    priceEstimate: "£££",
    estimatedCost: 38,
    openingHours: "Late night",
    sourceType: "manual",
    tags: ["nightlife", "late", "music"],
    confidence: 0.84,
    startsAt: "2026-06-06T22:00:00Z",
    endsAt: "2026-06-07T04:00:00Z",
    createdAt: "2026-06-06T11:30:00Z",
    updatedAt: "2026-06-06T11:30:00Z"
  }
];

export const seededCriteria: PlanningCriteria[] = [
  {
    userId: "jeff",
    budgetMax: 35,
    availableTimes: ["Tonight after 7", "Sunday afternoon"],
    postalCode: "E1 6AN",
    vetoes: ["clubs"]
  },
  {
    userId: "praya",
    budgetMax: 30,
    availableTimes: ["Tonight after 7", "Sunday afternoon"],
    postalCode: "SW9 8JH",
    vetoes: ["too expensive"]
  },
  {
    userId: "tana",
    budgetMax: 25,
    availableTimes: ["Sunday afternoon"],
    postalCode: "N1C 4QP",
    vetoes: ["long queues"]
  }
];

export const seededRecommendations: Recommendation[] = [
  {
    bucketItemId: "borough-market",
    score: 94,
    reasons: ["Under all budgets", "Flexible food choices avoid vetoes", "Central enough for all three"],
    warnings: ["Best before late afternoon"]
  },
  {
    bucketItemId: "tate-modern",
    score: 88,
    reasons: ["Low-cost option", "Works on Sunday afternoon", "Easy add-on with a river walk"],
    warnings: []
  },
  {
    bucketItemId: "dishoom-kings-cross",
    score: 81,
    reasons: ["Group-friendly food", "Near Tana's postcode", "Reliable fallback with a clear plan"],
    warnings: ["Queue risk; book or arrive early"]
  }
];

export const seededMessages: ChatMessage[] = [
  {
    id: "msg-1",
    userId: "praya",
    text: "We need something for Sunday that doesn't become another 80-message debate.",
    createdAt: "2026-06-06T12:00:00Z"
  },
  {
    id: "msg-2",
    userId: "jeff",
    text: "@planner use our saved spots and find the best 3 options.",
    createdAt: "2026-06-06T12:01:00Z"
  },
  {
    id: "msg-3",
    userId: "planner",
    text: "Got it. I need budget, availability, postcode, and vetoes from Jeff, Praya, and Tana.",
    createdAt: "2026-06-06T12:01:12Z"
  }
];
