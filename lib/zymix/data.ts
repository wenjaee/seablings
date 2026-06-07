import type { PersonaId } from "@/lib/domain";

export type AvatarSpec =
  | { kind: "checker" }
  | { kind: "initials"; initials: string; bg: string; fg?: string }
  | { kind: "tile"; bg: string; emoji: string; rounded?: "lg" | "full" }
  | { kind: "speaker" };

export type ZymixPersonaId = PersonaId | "tester";

export type ZymixPersona = {
  id: ZymixPersonaId;
  name: string;
  handle: string;
  color: string;
  avatar: AvatarSpec;
  followers: number;
  following: number;
  stats: Array<{ label: string; value: number }>;
  walletVerified: boolean;
};

export type Conversation = {
  id: "seablings" | ZymixPersonaId;
  name: string;
  href: `/chat/${string}`;
  avatar: AvatarSpec;
  subtitle?: string;
  preview: string;
  time: string;
  unread?: number;
  verified?: boolean;
};

export type ThreadMessage =
  | { id: string; kind: "system"; text: string }
  | {
      id: string;
      kind: "message";
      authorId: ZymixPersonaId;
      authorName: string;
      avatar: AvatarSpec;
      text: string;
      time: string;
      mine?: boolean;
      pending?: boolean;
      failed?: boolean;
    };

export type ThreadData = {
  routeId: string;
  threadId: string;
  name: string;
  avatar: AvatarSpec;
  subtitle: string;
  dateLabel: string;
  verified?: boolean;
  initialMessages: ThreadMessage[];
};

const PERSONAS: ZymixPersona[] = [
  {
    id: "jeff",
    name: "Jeff",
    handle: "@jeff",
    color: "#0f766e",
    avatar: { kind: "checker" },
    followers: 12,
    following: 19,
    stats: [
      { label: "Karma", value: 18 },
      { label: "Contributions", value: 7 },
      { label: "Account Age", value: 1 }
    ],
    walletVerified: false
  },
  {
    id: "praya",
    name: "Praya",
    handle: "@praya",
    color: "#b9714e",
    avatar: { kind: "initials", initials: "P", bg: "#b9714e" },
    followers: 8,
    following: 15,
    stats: [
      { label: "Karma", value: 11 },
      { label: "Contributions", value: 5 },
      { label: "Account Age", value: 1 }
    ],
    walletVerified: false
  },
  {
    id: "tana",
    name: "Tana",
    handle: "@tana",
    color: "#5a7f36",
    avatar: { kind: "initials", initials: "T", bg: "#5a7f36" },
    followers: 6,
    following: 11,
    stats: [
      { label: "Karma", value: 9 },
      { label: "Contributions", value: 4 },
      { label: "Account Age", value: 1 }
    ],
    walletVerified: false
  },
  {
    id: "tester",
    name: "Tester",
    handle: "@tester",
    color: "#4c5c7a",
    avatar: { kind: "tile", bg: "#4c5c7a", emoji: "🧪", rounded: "full" },
    followers: 1,
    following: 3,
    stats: [
      { label: "Karma", value: 2 },
      { label: "Contributions", value: 1 },
      { label: "Account Age", value: 0 }
    ],
    walletVerified: false
  }
];

const PERSONA_MAP = Object.fromEntries(PERSONAS.map((persona) => [persona.id, persona])) as Record<ZymixPersonaId, ZymixPersona>;

const DM_PREVIEWS: Partial<Record<ZymixPersonaId, string>> = {
  jeff: "Jeff: I can take Shoreditch side.",
  praya: "Praya: hi",
  tana: "Tana: I found a good backup plan.",
  tester: "Tester: demo path is looking good."
};

export const loginPersonas = PERSONAS;

export function getZymixPersona(id: string | null | undefined): ZymixPersona | null {
  if (!id) {
    return null;
  }

  return PERSONA_MAP[id as ZymixPersonaId] ?? null;
}

export function isSeededPersonaId(id: string | null | undefined): id is PersonaId {
  return id === "jeff" || id === "praya" || id === "tana";
}

export function getFriendAvatars(currentPersonaId: ZymixPersonaId) {
  return PERSONAS.filter((persona) => persona.id !== currentPersonaId).map((persona) => persona.avatar);
}

export function getDmThreadId(a: ZymixPersonaId, b: ZymixPersonaId) {
  const [left, right] = [a, b].sort();
  return `dm:${left}:${right}`;
}

function getGroupInitialMessages(): ThreadMessage[] {
  return [
    { id: "group-create", kind: "system", text: "SEAblings group created" },
    {
      id: "group-praya-hi",
      kind: "message",
      authorId: "praya",
      authorName: "Praya",
      avatar: PERSONA_MAP.praya.avatar,
      text: "hi",
      time: "12:09"
    }
  ];
}

function getDirectInitialMessages(otherPersonaId: ZymixPersonaId): ThreadMessage[] {
  const other = PERSONA_MAP[otherPersonaId];

  return [
    { id: `dm-${otherPersonaId}-friends`, kind: "system", text: "You are now connected on Zymix" },
    {
      id: `dm-${otherPersonaId}-hello`,
      kind: "message",
      authorId: other.id,
      authorName: other.name,
      avatar: other.avatar,
      text: `Hey, ping me here when you want to plan.`,
      time: "11:42"
    }
  ];
}

export function getConversations(currentPersonaId: ZymixPersonaId): Conversation[] {
  const others = PERSONAS.filter((persona) => persona.id !== currentPersonaId);

  return [
    {
      id: "seablings",
      name: "SEAblings",
      href: "/chat/seablings",
      avatar: { kind: "checker" },
      subtitle: "4 members",
      preview: "Praya: hi",
      time: "7h",
      unread: 3,
      verified: true
    },
    ...others.map((persona, index) => ({
      id: persona.id,
      name: persona.name,
      href: `/chat/${persona.id}` as `/chat/${string}`,
      avatar: persona.avatar,
      preview: DM_PREVIEWS[persona.id] ?? `${persona.name}: demo chat ready.`,
      time: index === 0 ? "25m" : index === 1 ? "3h" : "7h"
    }))
  ];
}

export function getThreadData(routeId: string, currentPersonaId: ZymixPersonaId): ThreadData | null {
  if (routeId === "seablings") {
    return {
      routeId,
      threadId: "group:seablings",
      name: "SEAblings",
      avatar: { kind: "checker" },
      subtitle: "4 members",
      dateLabel: "Today 12:07 PM",
      verified: true,
      initialMessages: getGroupInitialMessages()
    };
  }

  const other = getZymixPersona(routeId);
  if (!other || other.id === currentPersonaId) {
    return null;
  }

  return {
    routeId,
    threadId: getDmThreadId(currentPersonaId, other.id),
    name: other.name,
    avatar: other.avatar,
    subtitle: "Direct message",
    dateLabel: "Today",
    initialMessages: getDirectInitialMessages(other.id)
  };
}

export function normalizePersonaPayload(payload: unknown): ZymixPersona | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const nested = record.persona;
  if (nested && typeof nested === "object") {
    const nestedPersona = nested as Record<string, unknown>;
    const nestedId = typeof nestedPersona.id === "string" ? nestedPersona.id : null;
    const resolvedNested = getZymixPersona(nestedId);
    if (resolvedNested) {
      return resolvedNested;
    }
  }

  const id = typeof record.id === "string" ? record.id : null;
  return getZymixPersona(id);
}
