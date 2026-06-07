"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Bell, ChevronRight, Plus, Search } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { Avatar } from "@/components/zymix/avatar";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { TabBar } from "@/components/zymix/tab-bar";
import { useCurrentPersona } from "@/components/zymix/persona-session";
import { getBrowserSupabaseClient } from "@/lib/zymix/supabase-browser";
import {
  getConversations,
  getDmThreadId,
  getZymixPersona,
  type Conversation,
  type ZymixPersonaId
} from "@/lib/zymix/data";
import type { ZymixMessage } from "@/lib/domain";

type LatestByThread = Record<string, ZymixMessage | null>;

function conversationThreadId(conversation: Conversation, personaId: ZymixPersonaId): string {
  return conversation.id === "seablings" ? "group:seablings" : getDmThreadId(personaId, conversation.id);
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

function authorLabel(userId: string, personaId: ZymixPersonaId): string {
  if (userId === personaId) {
    return "You";
  }

  return getZymixPersona(userId)?.name ?? userId;
}

export function ChatListScreen() {
  const { persona, isLoading, error } = useCurrentPersona({ redirectToLogin: true });
  const personaId = persona?.id;
  const conversations = useMemo(() => (personaId ? getConversations(personaId) : []), [personaId]);
  const [latest, setLatest] = useState<LatestByThread>({});

  useEffect(() => {
    if (!personaId || conversations.length === 0) {
      return;
    }

    const threadIds = conversations.map((conversation) => conversationThreadId(conversation, personaId));
    let isDisposed = false;

    async function loadSummary() {
      try {
        const response = await fetch(
          `/api/zymix-messages/summary?threadIds=${encodeURIComponent(threadIds.join(","))}`,
          { cache: "no-store", credentials: "include" }
        );
        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as { latest?: LatestByThread } | null;
        if (!isDisposed && payload?.latest) {
          setLatest(payload.latest);
        }
      } catch {
        // Keep fixture previews when the summary fetch fails.
      }
    }

    void loadSummary();

    const client = getBrowserSupabaseClient();
    let channel: RealtimeChannel | null = null;
    let pollId: number | null = null;

    if (client) {
      channel = client
        .channel("zymix-chat-list")
        .on("postgres_changes", { event: "*", schema: "public", table: "zymix_messages" }, () => {
          void loadSummary();
        })
        .subscribe();
    } else {
      pollId = window.setInterval(() => {
        void loadSummary();
      }, 10000);
    }

    return () => {
      isDisposed = true;
      if (pollId) {
        window.clearInterval(pollId);
      }
      if (channel) {
        void channel.unsubscribe();
      }
    };
  }, [personaId, conversations]);

  const rows = useMemo(() => {
    if (!personaId) {
      return [];
    }

    return conversations
      .map((conversation) => {
        const threadId = conversationThreadId(conversation, personaId);
        const message = latest[threadId] ?? null;
        const preview = message
          ? `${authorLabel(message.userId, personaId)}: ${message.text.slice(0, 80)}`
          : "No messages yet";
        const time = message ? formatRelativeTime(message.createdAt) : "";
        return { conversation, sortKey: message?.createdAt ?? "", preview, time };
      })
      .sort((left, right) => {
        if (left.sortKey && right.sortKey) {
          return right.sortKey.localeCompare(left.sortKey);
        }
        if (left.sortKey) {
          return -1;
        }
        if (right.sortKey) {
          return 1;
        }
        return 0;
      });
  }, [conversations, latest, personaId]);

  return (
    <PhoneShell>
      <main className="zx-hide-scroll flex-1 overflow-y-auto px-4 pt-2">
        <svg width={0} height={0} className="absolute">
          <defs>
            <linearGradient id="zxBell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#cdeb4e" />
              <stop offset="1" stopColor="#2bc23a" />
            </linearGradient>
          </defs>
        </svg>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[30px] font-black tracking-tight text-[var(--zx-ink)]">ZYMIX</h1>
            <p className="truncate text-[14px] text-[var(--zx-muted)]">
              {persona ? `Logged in as ${persona.name}` : "Checking session..."}
            </p>
          </div>
          <button
            type="button"
            aria-label="New"
            className="relative grid h-12 w-12 place-items-center rounded-full bg-white shadow-[0_8px_22px_rgba(0,0,0,0.12)]"
          >
            <Plus size={24} className="text-[var(--zx-ink)]" />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[var(--zx-brand)] ring-2 ring-white" />
          </button>
        </div>

        <button type="button" className="mt-5 flex w-full items-center gap-3">
          <Bell size={32} strokeWidth={1.6} stroke="url(#zxBell)" fill="url(#zxBell)" />
          <span className="text-[19px] font-bold text-[var(--zx-ink)]">Activity</span>
          <ChevronRight size={20} className="ml-auto text-[var(--zx-faint)]" />
        </button>

        <div className="mt-4 flex items-center gap-2.5 rounded-full bg-[var(--zx-surface)] px-4 py-3">
          <Search size={20} className="text-[var(--zx-muted)]" />
          <span className="text-[16px] text-[var(--zx-muted)]">Search</span>
        </div>

        {isLoading ? <p className="mt-6 text-[15px] text-[var(--zx-muted)]">Loading chats...</p> : null}
        {error ? <p className="mt-6 text-[15px] text-[#d94c3d]">{error}</p> : null}

        <div className="mt-3">
          {rows.map(({ conversation, preview, time }) => (
            <Link key={conversation.id} href={conversation.href as Route} className="flex items-center gap-3.5 active:opacity-70">
              <Avatar spec={conversation.avatar} size={56} />
              <div className="flex min-w-0 flex-1 items-start gap-2 border-b border-[var(--zx-line)] py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[17px] font-bold text-[var(--zx-ink)]">{conversation.name}</span>
                    {conversation.verified ? (
                      <BadgeCheck size={18} className="shrink-0" fill="var(--zx-brand)" stroke="#ffffff" strokeWidth={2.4} aria-hidden />
                    ) : null}
                  </div>
                  {conversation.subtitle ? (
                    <p className="mt-0.5 truncate text-[14px] text-[var(--zx-muted)]">{conversation.subtitle}</p>
                  ) : null}
                  <p className="mt-0.5 truncate text-[14px] text-[var(--zx-muted)]">
                    {preview}
                    {time ? ` · ${time}` : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="h-4" />
      </main>

      <TabBar active="chat" />
    </PhoneShell>
  );
}
