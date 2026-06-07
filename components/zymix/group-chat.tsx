"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Camera, Mic, MoreHorizontal, Plus, RefreshCcw, Send, Sticker } from "lucide-react";
import { type RealtimeChannel } from "@supabase/supabase-js";

import { PlannerCelebration, PlannerDock, PlannerThread } from "@/components/planner/planner-layer";
import { usePlanner } from "@/components/planner/planner-provider";
import { Avatar } from "@/components/zymix/avatar";
import { useCurrentPersona } from "@/components/zymix/persona-session";
import { getBrowserSupabaseClient } from "@/lib/zymix/supabase-browser";
import { getThreadData, getZymixPersona, type ThreadData, type ThreadMessage, type ZymixPersonaId } from "@/lib/zymix/data";

type ZymixMessageResponse = {
  messages?: unknown[];
};

type MessageRecord = Record<string, unknown>;

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Now";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function isRecord(value: unknown): value is MessageRecord {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeMessageRecord(record: unknown, currentPersonaId: ZymixPersonaId): ThreadMessage | null {
  if (!isRecord(record)) {
    return null;
  }

  if (record.kind === "system" || record.type === "system") {
    const systemText = readString(record.text) ?? readString(record.body) ?? readString(record.message);
    const systemId = readString(record.id) ?? `system-${systemText ?? "message"}`;

    return systemText ? { id: systemId, kind: "system", text: systemText } : null;
  }

  const authorId =
    readString(record.authorId) ??
    readString(record.author_id) ??
    readString(record.userId) ??
    readString(record.user_id) ??
    readString(record.personaId) ??
    readString(record.persona_id);
  const text = readString(record.text) ?? readString(record.body) ?? readString(record.message);
  const createdAt = readString(record.createdAt) ?? readString(record.created_at) ?? new Date().toISOString();
  const author = getZymixPersona(authorId);

  if (!author || !text) {
    return null;
  }

  return {
    id: readString(record.id) ?? `${author.id}-${createdAt}-${text.slice(0, 8)}`,
    kind: "message",
    authorId: author.id,
    authorName: author.name,
    avatar: author.avatar,
    text,
    time: formatMessageTime(createdAt),
    mine: author.id === currentPersonaId
  };
}

async function fetchThreadMessages(threadId: string, currentPersonaId: ZymixPersonaId) {
  const response = await fetch(`/api/zymix-messages?threadId=${encodeURIComponent(threadId)}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to load this chat.");
  }

  const payload = (await response.json().catch(() => null)) as ZymixMessageResponse | unknown[] | null;
  const records = Array.isArray(payload) ? payload : Array.isArray(payload?.messages) ? payload.messages : [];
  const normalized = records
    .map((record) => normalizeMessageRecord(record, currentPersonaId))
    .filter((message): message is ThreadMessage => Boolean(message));

  return normalized;
}

async function postMessage(threadId: string, text: string) {
  const response = await fetch("/api/zymix-messages", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      threadId,
      text
    })
  });

  if (!response.ok) {
    throw new Error("Unable to send your message.");
  }
}

function subscribeToThread(threadId: string, onRefresh: () => void) {
  const client = getBrowserSupabaseClient();
  if (!client) {
    return null;
  }

  const channel = client
    .channel(`zymix-thread:${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "zymix_messages",
        filter: `thread_id=eq.${threadId}`
      },
      () => {
        onRefresh();
      }
    )
    .subscribe();

  return channel;
}

function LoadingState() {
  return <p className="px-4 pt-8 text-center text-[15px] text-[var(--zx-muted)]">Loading chat...</p>;
}

function ErrorState({ message }: { message: string }) {
  return <p className="px-4 pt-8 text-center text-[15px] text-[#d94c3d]">{message}</p>;
}

function MessageComposer({
  draft,
  setDraft,
  hasDraft,
  send,
  isSending
}: {
  draft: string;
  setDraft: (value: string) => void;
  hasDraft: boolean;
  send: () => void;
  isSending: boolean;
}) {
  return (
    <div className="shrink-0 px-3 pt-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Add"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/5 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
        >
          <Plus size={22} />
        </button>

        <div className="flex flex-1 items-center gap-2 rounded-full bg-[var(--zx-surface)] px-4 py-2.5">
          <input
            name="message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Message"
            aria-label="Message"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--zx-ink)] outline-none placeholder:text-[var(--zx-muted)]"
          />
          <button type="button" aria-label="Sticker" className="shrink-0 text-[var(--zx-ink)]">
            <Sticker size={22} />
          </button>
        </div>

        {hasDraft ? (
          <button
            type="button"
            onClick={send}
            disabled={isSending}
            aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--zx-brand)] text-white shadow-[0_4px_14px_rgba(53,201,60,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={20} />
          </button>
        ) : (
          <>
            <button
              type="button"
              aria-label="Camera"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/5 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
            >
              <Camera size={22} />
            </button>
            <button
              type="button"
              aria-label="Voice"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/5 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
            >
              <Mic size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ChatView({
  thread,
  messages,
  error,
  draft,
  setDraft,
  send,
  isSending,
  isRefreshing
}: {
  thread: ThreadData;
  messages: ThreadMessage[];
  error: string | null;
  draft: string;
  setDraft: (value: string) => void;
  send: () => void;
  isSending: boolean;
  isRefreshing: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const hasDraft = draft.trim().length > 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PlannerCelebration />
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-1">
        <Link
          href="/"
          aria-label="Back"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-black/5 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.10)]"
        >
          <ArrowLeft size={22} />
        </Link>

        <div className="flex flex-1 items-center justify-center gap-2.5">
          <Avatar spec={thread.avatar} size={36} />
          <div>
            <p className="flex items-center gap-1.5 text-[17px] font-semibold leading-tight text-[var(--zx-ink)]">
              <span>{thread.name}</span>
              {thread.verified ? (
                <BadgeCheck size={16} className="shrink-0" fill="var(--zx-brand)" stroke="#ffffff" strokeWidth={2.4} aria-hidden />
              ) : null}
            </p>
            <p className="text-[13px] leading-tight text-[var(--zx-muted)]">{thread.subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          aria-label="More"
          className="grid h-11 w-11 place-items-center rounded-full border border-black/5 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.10)]"
        >
          <MoreHorizontal size={22} />
        </button>
      </header>

      <div className="zx-hide-scroll flex-1 overflow-y-auto px-4">
        <p className="py-4 text-center text-[13px] text-[var(--zx-muted)]">{thread.dateLabel}</p>
        {isRefreshing ? (
          <p className="mb-3 flex items-center justify-center gap-2 text-[12px] font-medium text-[var(--zx-muted)]">
            <RefreshCcw size={13} />
            Syncing
          </p>
        ) : null}
        {error ? <p className="mb-3 text-center text-[13px] text-[#d94c3d]">{error}</p> : null}

        {messages.map((message) =>
          message.kind === "system" ? (
            <p key={message.id} className="py-2 text-center text-[13px] text-[var(--zx-muted)]">
              {message.text}
            </p>
          ) : message.mine ? (
            <div key={message.id} className="mb-3 flex justify-end">
              <div
                className={
                  message.failed
                    ? "flex max-w-[78%] items-end gap-2 rounded-2xl rounded-tr-md bg-[#ffd8d3] px-3.5 py-2"
                    : "flex max-w-[78%] items-end gap-2 rounded-2xl rounded-tr-md bg-[var(--zx-brand)] px-3.5 py-2"
                }
              >
                <span className={message.failed ? "text-[15px] leading-snug text-[#9f2417]" : "text-[15px] leading-snug text-white"}>
                  {message.text}
                </span>
                <span className={message.failed ? "shrink-0 text-[11px] leading-snug text-[#9f2417]/75" : "shrink-0 text-[11px] leading-snug text-white/75"}>
                  {message.pending ? "..." : message.time}
                </span>
              </div>
            </div>
          ) : (
            <div key={message.id} className="mb-3 flex items-start gap-2">
              <Avatar spec={message.avatar} size={36} />
              <div className="min-w-0">
                <p className="mb-1 text-[15px] font-semibold text-[var(--zx-ink)]">{message.authorName}</p>
                <div className="flex max-w-[78%] items-end gap-2 rounded-2xl rounded-tl-md bg-[var(--zx-surface)] px-3.5 py-2">
                  <span className="text-[15px] leading-snug text-[var(--zx-ink)]">{message.text}</span>
                  <span className="shrink-0 text-[11px] leading-snug text-[var(--zx-faint)]">{message.time}</span>
                </div>
              </div>
            </div>
          )
        )}
        <PlannerThread />
        <div ref={endRef} />
      </div>

      <PlannerDock />
      <MessageComposer draft={draft} setDraft={setDraft} hasDraft={hasDraft} send={send} isSending={isSending} />
    </div>
  );
}

export function GroupChat({ chatId }: { chatId: string }) {
  const { persona, isLoading, error: sessionError } = useCurrentPersona({ redirectToLogin: true });
  const personaId = persona?.id;
  const { start } = usePlanner();
  const thread = useMemo(() => (personaId ? getThreadData(chatId, personaId) : null), [chatId, personaId]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!thread || !persona) {
      return;
    }

    const currentThread = thread;
    const currentPersona = persona;
    let isActive = true;

    async function loadMessages() {
      setIsRefreshing(true);
      setError(null);

      try {
        const nextMessages = await fetchThreadMessages(currentThread.threadId, currentPersona.id);
        if (!isActive) {
          return;
        }

        setMessages(nextMessages);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setMessages([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load this chat.");
      } finally {
        if (isActive) {
          setIsRefreshing(false);
        }
      }
    }

    void loadMessages();

    return () => {
      isActive = false;
    };
  }, [persona, thread]);

  useEffect(() => {
    if (!thread || !persona) {
      return;
    }

    const currentThread = thread;
    const currentPersona = persona;
    let pollId: number | null = null;
    let channel: RealtimeChannel | null = null;
    let isDisposed = false;

    async function refreshFromRemote() {
      try {
        const nextMessages = await fetchThreadMessages(currentThread.threadId, currentPersona.id);
        if (!isDisposed && nextMessages.length > 0) {
          setMessages(nextMessages);
        }
      } catch {
        // Keep the current local state when background refresh fails.
      }
    }

    channel = subscribeToThread(currentThread.threadId, () => {
      void refreshFromRemote();
    });

    if (!channel) {
      pollId = window.setInterval(() => {
        void refreshFromRemote();
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
  }, [persona, thread]);

  function replacePendingMessage(messageId: string, nextMessage: ThreadMessage) {
    setMessages((previousMessages) => previousMessages.map((message) => (message.id === messageId ? nextMessage : message)));
  }

  function markFailedMessage(messageId: string, failureMessage: string) {
    setMessages((previousMessages) =>
      previousMessages.map((message) =>
        message.id === messageId && message.kind === "message"
          ? {
              ...message,
              pending: false,
              failed: true,
              time: "Retry",
              text: message.text
            }
          : message
      )
    );
    setError(failureMessage);
  }

  async function send() {
    if (!thread || !persona || isSending) {
      return;
    }

    const text = draft.trim();
    if (!text) {
      return;
    }

    if (text.toLowerCase().includes("@planner")) {
      void start(persona.id);
    }

    const now = new Date();
    const pendingId = `pending-${now.getTime()}`;
    const pendingMessage: ThreadMessage = {
      id: pendingId,
      kind: "message",
      authorId: persona.id,
      authorName: persona.name,
      avatar: persona.avatar,
      text,
      time: formatMessageTime(now.toISOString()),
      mine: true,
      pending: true
    };

    setMessages((previousMessages) => [...previousMessages, pendingMessage]);
    setDraft("");
    setError(null);
    setIsSending(true);

    try {
      await postMessage(thread.threadId, text);
      replacePendingMessage(pendingId, {
        ...pendingMessage,
        pending: false
      });

      const nextMessages = await fetchThreadMessages(thread.threadId, persona.id).catch(() => null);
      if (nextMessages?.length) {
        setMessages(nextMessages);
      }
    } catch (sendError) {
      markFailedMessage(pendingId, sendError instanceof Error ? sendError.message : "Unable to send your message.");
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (sessionError) {
    return <ErrorState message={sessionError} />;
  }

  if (!thread) {
    return <ErrorState message="This chat is unavailable for the current persona." />;
  }

  return (
    <ChatView
      thread={thread}
      messages={messages}
      error={error}
      draft={draft}
      setDraft={setDraft}
      send={() => {
        void send();
      }}
      isSending={isSending}
      isRefreshing={isRefreshing}
    />
  );
}
