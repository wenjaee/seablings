export type AvatarSpec =
  | { kind: "checker" }
  | { kind: "initials"; initials: string; bg: string; fg?: string }
  | { kind: "tile"; bg: string; emoji: string; rounded?: "lg" | "full" }
  | { kind: "speaker" };

export type Conversation = {
  id: string;
  name: string;
  avatar: AvatarSpec;
  members?: string;
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
      authorId: string;
      authorName: string;
      avatar: AvatarSpec;
      text: string;
      time: string;
      mine?: boolean;
    };

export type ThreadData = {
  id: string;
  name: string;
  members: number;
  avatar: AvatarSpec;
  dateLabel: string;
  messages: ThreadMessage[];
};

const prayaAvatar: AvatarSpec = { kind: "initials", initials: "P", bg: "#b9714e" };

export const profile = {
  displayName: "inajeffyy",
  handle: "@zymix_321gq0",
  followers: 0,
  following: 0,
  stats: [
    { label: "Karma", value: 0 },
    { label: "Contributions", value: 0 },
    { label: "Account Age", value: 0 }
  ],
  walletVerified: false,
  avatar: { kind: "checker" } as AvatarSpec,
  friends: [prayaAvatar, { kind: "checker" } as AvatarSpec]
};

export const conversations: Conversation[] = [
  {
    id: "zymix-early-builders",
    name: "ZYMIX_Early Builders",
    avatar: { kind: "tile", bg: "#0c0c0c", emoji: "🌿", rounded: "lg" },
    members: "79 members",
    preview: "1337XCode: [Location]",
    time: "25m",
    unread: 3
  },
  {
    id: "service-notifications",
    name: "Service Notifications",
    avatar: { kind: "speaker" },
    preview: "[Message]",
    time: "3h"
  },
  {
    id: "seablings",
    name: "seablings",
    avatar: { kind: "checker" },
    members: "3 members",
    preview: "Praya Tjon...: hi",
    time: "7h",
    verified: true
  },
  {
    id: "tana",
    name: "tana",
    avatar: { kind: "checker" },
    preview: "You are now friends",
    time: "7h"
  },
  {
    id: "praya-tjondro",
    name: "Praya Tjondro",
    avatar: prayaAvatar,
    preview: "You are now friends",
    time: "7h"
  }
];

const seablingsThread: ThreadData = {
  id: "seablings",
  name: "seablings",
  members: 3,
  avatar: { kind: "checker" },
  dateLabel: "Today 12:07 PM",
  messages: [
    { id: "sys-create", kind: "system", text: "inajeffyy created the group" },
    {
      id: "m-praya-hi",
      kind: "message",
      authorId: "praya",
      authorName: "Praya Tjondro",
      avatar: prayaAvatar,
      text: "hi",
      time: "12:09"
    }
  ]
};

export function getThread(id: string): ThreadData {
  if (id === "seablings") {
    return seablingsThread;
  }

  const conv = conversations.find((candidate) => candidate.id === id);

  return {
    id,
    name: conv?.name ?? "Chat",
    members: 2,
    avatar: conv?.avatar ?? { kind: "checker" },
    dateLabel: "Today",
    messages: [{ id: "sys-friends", kind: "system", text: "You are now friends" }]
  };
}
