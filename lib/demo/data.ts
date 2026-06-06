import type {
  BucketItem,
  BucketItemStatus,
  ChatMessage,
  IngestionTask,
  Persona,
  PersonaId,
  PlanningCriteria,
  Recommendation,
  SourcePlatform
} from "@/lib/domain";
import {
  personas,
  seededBucketItems,
  seededCriteria,
  seededMessages,
  seededRecommendations
} from "@/lib/fixtures";

export type DemoTimelineMessage = ChatMessage & {
  stage: "seeded" | "criteria" | "result";
};

export type DemoRecommendation = Recommendation & {
  item: BucketItem;
  owner: Persona;
};

export type DemoCaptureTask = IngestionTask & {
  label: string;
};

const statusOrder: Record<BucketItemStatus, number> = {
  candidate: 0,
  saved: 1,
  completed: 2,
  rejected: 3,
  archived: 4
};

const personaMap = Object.fromEntries(personas.map((persona) => [persona.id, persona])) as Record<PersonaId, Persona>;
const criteriaMap = Object.fromEntries(seededCriteria.map((criteria) => [criteria.userId, criteria])) as Record<
  PersonaId,
  PlanningCriteria
>;

const recommendationItems = seededRecommendations
  .map((recommendation) => {
    const item = seededBucketItems.find((bucketItem) => bucketItem.id === recommendation.bucketItemId);

    if (!item) {
      return null;
    }

    return {
      ...recommendation,
      item,
      owner: personaMap[item.userId]
    } satisfies DemoRecommendation;
  })
  .filter((recommendation): recommendation is DemoRecommendation => recommendation !== null);

const latestQueuedCapture: DemoCaptureTask = {
  id: "capture-rooftop-queued",
  userId: "jeff",
  status: "queued",
  sourceType: "text",
  text: "Spitalfields rooftop shortlist from group chat",
  createdAt: "2026-06-06T12:09:00Z",
  updatedAt: "2026-06-06T12:09:00Z",
  label: "Jeff dropped a fresh text capture into the queue"
};

const completedCaptureTasks: DemoCaptureTask[] = seededBucketItems
  .filter((item) => item.sourceType !== "manual")
  .slice(0, 4)
  .map((item, index) => ({
    id: `capture-${item.id}`,
    userId: item.userId,
    status: "completed",
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    screenshotName: item.sourceType === "screenshot" ? `${item.title}.png` : undefined,
    text: item.description,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    label:
      index === 0 && item.userId === "jeff"
        ? `Live share converted ${item.title} into a candidate spot`
        : `${personaMap[item.userId].name} capture resolved to ${item.title}`
  }));

export const demoCaptureTasks: DemoCaptureTask[] = [latestQueuedCapture, ...completedCaptureTasks];

export const demoPersonas = personas;

export const pooledBucketItems = [...seededBucketItems].sort((left, right) => {
  if (statusOrder[left.status] !== statusOrder[right.status]) {
    return statusOrder[left.status] - statusOrder[right.status];
  }

  return right.updatedAt.localeCompare(left.updatedAt);
});

export const timelineMessages: DemoTimelineMessage[] = [
  ...seededMessages.map((message) => ({
    ...message,
    stage: "seeded" as const
  })),
  ...seededCriteria.map((criteria, index) => ({
    id: `criteria-${criteria.userId}`,
    userId: criteria.userId,
    text: `Budget up to GBP ${criteria.budgetMax}, free ${criteria.availableTimes.join(" or ")}, near ${
      criteria.postalCode
    }, veto: ${criteria.vetoes.join(", ")}.`,
    createdAt: `2026-06-06T12:0${index + 2}:00Z`,
    stage: "criteria" as const
  })),
  {
    id: "planner-result",
    userId: "planner",
    text: `Top 3: ${recommendationItems
      .map((recommendation, index) => `${index + 1}. ${recommendation.item.title}`)
      .join("  ")}. Borough Market wins on budget and flexibility.`,
    createdAt: "2026-06-06T12:06:00Z",
    stage: "result" as const
  }
];

export function getPersona(personaId: PersonaId): Persona {
  const persona = personaMap[personaId];
  if (!persona) {
    throw new Error(`Unknown persona id: ${personaId}`);
  }
  return persona;
}

export function getCriteria(personaId: PersonaId): PlanningCriteria {
  const criteria = criteriaMap[personaId];
  if (!criteria) {
    throw new Error(`Missing planning criteria for persona id: ${personaId}`);
  }
  return criteria;
}

export function getBucketItemsForPersona(personaId: PersonaId): BucketItem[] {
  return pooledBucketItems.filter((item) => item.userId === personaId);
}

export function getRecommendations(): DemoRecommendation[] {
  return recommendationItems;
}

export function getSourceLabel(sourceType: SourcePlatform): string {
  switch (sourceType) {
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "screenshot":
      return "Screenshot";
    case "manual":
      return "Manual";
    case "text":
      return "Text";
    default:
      return sourceType;
  }
}

export function getStatusLabel(status: BucketItemStatus): string {
  switch (status) {
    case "candidate":
      return "Candidate";
    case "saved":
      return "Saved";
    case "completed":
      return "Done";
    case "rejected":
      return "Rejected";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export function formatMoney(value: number): string {
  return `GBP ${value}`;
}

export function formatTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoTimestamp));
}
