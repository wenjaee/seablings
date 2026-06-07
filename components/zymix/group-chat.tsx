"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Camera, Mic, MoreHorizontal, Plus, RefreshCcw, Send, Sticker, X } from "lucide-react";
import { type RealtimeChannel } from "@supabase/supabase-js";

import { Avatar } from "@/components/zymix/avatar";
import {
  PlannerCelebration,
  PlannerDock,
  PlannerThread,
  type CriteriaSubmitPayload,
  type PlannerSession
} from "@/components/zymix/planner-ui";
import { useCurrentPersona } from "@/components/zymix/persona-session";
import { getBrowserSupabaseClient } from "@/lib/zymix/supabase-browser";
import { getThreadData, getZymixPersona, type ThreadData, type ThreadMessage, type ZymixPersonaId } from "@/lib/zymix/data";

type ZymixMessageResponse = {
  messages?: unknown[];
};

type MessageRecord = Record<string, unknown>;

type PlannerApiResponse = {
  session?: PlannerSession | null;
};

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

function readErrorMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) {
    return fallback;
  }

  return typeof payload.error === "string" ? payload.error : fallback;
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

async function fetchPlannerSession(threadId: string) {
  const response = await fetch(`/api/planner-session?threadId=${encodeURIComponent(threadId)}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (response.status === 404) {
      throw new Error("Planner API unavailable.");
    }
    throw new Error(readErrorMessage(payload, "Unable to load planner session."));
  }

  const payload = (await response.json().catch(() => null)) as PlannerApiResponse | null;
  return isRecord(payload) ? payload.session ?? null : null;
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

async function postPlannerCriteria(threadId: string, payload: CriteriaSubmitPayload) {
  const response = await fetch("/api/planner-session/criteria", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      threadId,
      ...payload
    })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(readErrorMessage(errorPayload, "Failed to submit planner criteria."));
  }

  const responsePayload = (await response.json().catch(() => null)) as PlannerApiResponse | null;
  return isRecord(responsePayload) ? responsePayload.session ?? null : null;
}

async function postPlannerVote(threadId: string, bucketItemIds: string[]) {
  const response = await fetch("/api/planner-session/vote", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      threadId,
      bucketItemIds
    })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(readErrorMessage(errorPayload, "Failed to submit planner vote."));
  }

  const responsePayload = (await response.json().catch(() => null)) as PlannerApiResponse | null;
  return isRecord(responsePayload) ? responsePayload.session ?? null : null;
}

async function postPlannerCancel(threadId: string) {
  const response = await fetch("/api/planner-session/cancel", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      threadId
    })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(readErrorMessage(errorPayload, "Failed to cancel planner."));
  }

  const responsePayload = (await response.json().catch(() => null)) as PlannerApiResponse | null;
  return isRecord(responsePayload) ? responsePayload.session ?? null : null;
}

async function deletePlannerSession(threadId: string) {
  const response = await fetch(`/api/planner-session?threadId=${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(readErrorMessage(errorPayload, "Failed to remove planner."));
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

function getPlannerStorageKey(sessionId: string) {
  return `zymix-planner-minimized:${sessionId}`;
}

function getPlannerWinningItems(session: PlannerSession) {
  const finalPlanItems = session.finalPlan?.winningItems ?? [];
  if (finalPlanItems.length > 0) {
    return finalPlanItems;
  }

  const winnerIds = session.finalPlan?.winnerIds ?? [];
  if (winnerIds.length === 0) {
    return [];
  }

  return winnerIds
    .map((winnerId) => session.recommendations.find((recommendation) => recommendation.bucketItemId === winnerId)?.item)
    .filter((item): item is NonNullable<PlannerSession["finalPlan"]>["winningItems"][number] => Boolean(item));
}

function PlannerMinimizedBanner({
  session,
  onExpand,
  onRemove,
  isRemoving = false
}: {
  session: PlannerSession;
  onExpand: () => void;
  onRemove?: () => Promise<void> | void;
  isRemoving?: boolean;
}) {
  const winningItems = getPlannerWinningItems(session);
  const planLabel = winningItems.length > 0 ? winningItems.map((item) => item.title).join(" + ") : "Final plan";
  const proposedTime = session.finalPlan?.proposedTime ?? session.proposedTime ?? "TBC";

  return (
    <div className="shrink-0 px-4 pb-2">
      <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/6 bg-[var(--zx-ink)] px-3.5 py-2.5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-extrabold text-white">{planLabel}</span>
          <span className="block truncate text-[11px] font-semibold text-white/55">Confirmed · {proposedTime}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={isRemoving}
              aria-label="Remove confirmed plan"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              <X size={15} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onExpand}
            className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-[var(--zx-ink)]"
          >
            Show
          </button>
        </span>
      </div>
    </div>
  );
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
    <div className="shrink-0 px-2 pt-2 sm:px-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Add"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/5 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
        >
          <Plus size={22} />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--zx-surface)] px-4 py-2.5">
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
  isRefreshing,
  plannerSession,
  plannerError,
  isGroupChat,
  showCelebration,
  currentPersonaId,
  showCriteriaOverlay,
  showVotingOverlay,
  canCancel,
  onSubmitCriteria,
  onSubmitVote,
  onCancelPlanner,
  isSubmittingCriteria,
  isSubmittingVote,
  isCanceling,
  criteriaError,
  voteError,
  cancelError,
  isPlannerMinimized,
  onConfirmPlanner,
  onExpandPlanner,
  onRemovePlanner,
  isRemovingPlanner
}: {
  thread: ThreadData;
  messages: ThreadMessage[];
  error: string | null;
  draft: string;
  setDraft: (value: string) => void;
  send: () => void;
  isSending: boolean;
  isRefreshing: boolean;
  plannerSession: PlannerSession | null;
  plannerError: string | null;
  isGroupChat: boolean;
  showCelebration: boolean;
  currentPersonaId: ZymixPersonaId;
  showCriteriaOverlay: boolean;
  showVotingOverlay: boolean;
  canCancel: boolean;
  onSubmitCriteria: (payload: CriteriaSubmitPayload) => Promise<void>;
  onSubmitVote: (bucketItemIds: string[]) => Promise<void>;
  onCancelPlanner: () => Promise<void>;
  isSubmittingCriteria: boolean;
  isSubmittingVote: boolean;
  isCanceling: boolean;
  criteriaError: string | null;
  voteError: string | null;
  cancelError: string | null;
  isPlannerMinimized: boolean;
  onConfirmPlanner: () => void;
  onExpandPlanner: () => void;
  onRemovePlanner?: () => Promise<void> | void;
  isRemovingPlanner: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const hasDraft = draft.trim().length > 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-1">
        <Link
          href="/"
          aria-label="Back"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-black/5 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.10)]"
        >
          <ArrowLeft size={22} />
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5">
          <Avatar spec={thread.avatar} size={36} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[17px] font-semibold leading-tight text-[var(--zx-ink)]">
              <span className="truncate">{thread.name}</span>
              {thread.verified ? (
                <BadgeCheck size={16} className="shrink-0" fill="var(--zx-brand)" stroke="#ffffff" strokeWidth={2.4} aria-hidden />
              ) : null}
            </p>
            <p className="truncate text-[13px] leading-tight text-[var(--zx-muted)]">{thread.subtitle}</p>
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

      {isGroupChat && plannerSession ? <PlannerCelebration session={plannerSession} show={showCelebration} /> : null}

      {isGroupChat && plannerSession?.status === "completed" && isPlannerMinimized ? (
        <PlannerMinimizedBanner
          session={plannerSession}
          onExpand={onExpandPlanner}
          onRemove={onRemovePlanner}
          isRemoving={isRemovingPlanner}
        />
      ) : null}

      <div className="zx-hide-scroll flex-1 overflow-y-auto px-4">
        <p className="py-4 text-center text-[13px] text-[var(--zx-muted)]">{thread.dateLabel}</p>
        {isRefreshing ? (
          <p className="mb-3 flex items-center justify-center gap-2 text-[12px] font-medium text-[var(--zx-muted)]">
            <RefreshCcw size={13} />
            Syncing
          </p>
        ) : null}
        {error ? <p className="mb-3 text-center text-[13px] text-[#d94c3d]">{error}</p> : null}

        {isGroupChat ? <PlannerThreadError message={plannerError} /> : null}

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
                    ? "inline-flex min-w-0 max-w-[82%] items-end gap-2 rounded-2xl rounded-tr-md bg-[#ffd8d3] px-3.5 py-2"
                    : "inline-flex min-w-0 max-w-[82%] items-end gap-2 rounded-2xl rounded-tr-md bg-[var(--zx-brand)] px-3.5 py-2"
                }
              >
                <span
                  className={
                    message.failed
                      ? "min-w-0 whitespace-pre-wrap break-words text-[15px] leading-snug text-[#9f2417]"
                      : "min-w-0 whitespace-pre-wrap break-words text-[15px] leading-snug text-white"
                  }
                >
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
              <div className="min-w-0 flex-1">
                <p className="mb-1 truncate text-[15px] font-semibold text-[var(--zx-ink)]">{message.authorName}</p>
                <div className="inline-flex min-w-0 max-w-[82%] items-end gap-2 rounded-2xl rounded-tl-md bg-[var(--zx-surface)] px-3.5 py-2">
                  <span className="min-w-0 whitespace-pre-wrap break-words text-[15px] leading-snug text-[var(--zx-ink)]">{message.text}</span>
                  <span className="shrink-0 text-[11px] leading-snug text-[var(--zx-faint)]">{message.time}</span>
                </div>
              </div>
            </div>
          )
        )}
        {isGroupChat && plannerSession ? (
          <PlannerThread
            session={plannerSession}
            currentPersonaId={currentPersonaId}
            canCancel={canCancel}
            isCanceling={isCanceling}
            cancelError={cancelError}
            onCancel={onCancelPlanner}
            isMinimized={isPlannerMinimized}
            onConfirmPlan={onConfirmPlanner}
            onRemovePlan={onRemovePlanner}
            isRemovingPlan={isRemovingPlanner}
          />
        ) : null}
        <div ref={endRef} />
      </div>

      {isGroupChat && plannerSession ? (
        <PlannerDock
          session={plannerSession}
          showCriteriaOverlay={showCriteriaOverlay}
          showVotingOverlay={showVotingOverlay}
          isSubmittingCriteria={isSubmittingCriteria}
          isSubmittingVote={isSubmittingVote}
          criteriaError={criteriaError}
          voteError={voteError}
          onSubmitCriteria={(payload) => onSubmitCriteria(payload)}
          onSubmitVote={(bucketItemIds) => onSubmitVote(bucketItemIds)}
        />
      ) : null}

      <MessageComposer draft={draft} setDraft={setDraft} hasDraft={hasDraft} send={send} isSending={isSending} />
    </div>
  );
}

function PlannerThreadError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <p className="mb-3 text-center text-[12px] text-[#d94c3d]">{message}</p>;
}

export function GroupChat({ chatId }: { chatId: string }) {
  const { persona, isLoading, error: sessionError } = useCurrentPersona({ redirectToLogin: true });
  const personaId = persona?.id;
  const thread = useMemo(() => (personaId ? getThreadData(chatId, personaId) : null), [chatId, personaId]);
  const isGroupChat = thread?.routeId === "seablings";
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [plannerSession, setPlannerSession] = useState<PlannerSession | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerActionError, setPlannerActionError] = useState<string | null>(null);
  const [isSubmittingCriteria, setIsSubmittingCriteria] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isRemovingPlanner, setIsRemovingPlanner] = useState(false);
  const [celebratedSessionId, setCelebratedSessionId] = useState<string | null>(null);
  const [isPlannerMinimized, setIsPlannerMinimized] = useState(false);

  const refreshPlannerSession = useCallback(async () => {
    if (!thread || !isGroupChat) {
      return;
    }

    try {
      const nextSession = await fetchPlannerSession(thread.threadId);
      setPlannerSession(nextSession);
      setPlannerError(null);
    } catch (plannerLoadError) {
      if (plannerLoadError instanceof Error) {
        setPlannerError(plannerLoadError.message);
      } else {
        setPlannerError("Planner service unavailable.");
      }
    }
  }, [isGroupChat, thread]);

  useEffect(() => {
    if (!thread || !persona) {
      return;
    }

    const currentThread = thread;
    const currentPersona = persona;
    let isActive = true;
    let pollId: number | null = null;
    let channel: RealtimeChannel | null = null;

    async function refreshFromRemote() {
      try {
        const nextMessages = await fetchThreadMessages(currentThread.threadId, currentPersona.id);
        if (!isActive) {
          return;
        }

        if (nextMessages.length > 0) {
          setMessages(nextMessages);
        }
      } catch {
        // Keep the local state when realtime/poll refresh fails.
      }
    }

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

    channel = subscribeToThread(currentThread.threadId, () => {
      void refreshFromRemote();
    });

    if (!channel) {
      pollId = window.setInterval(() => {
        void refreshFromRemote();
      }, 10000);
    }

    return () => {
      isActive = false;
      if (pollId) {
        window.clearInterval(pollId);
      }
      if (channel) {
        void channel.unsubscribe();
      }
    };
  }, [persona, thread]);

  useEffect(() => {
    if (!thread || !isGroupChat) {
      return;
    }

    let plannerPollId: number | null = null;
    const initialPollId = window.setTimeout(() => {
      void refreshPlannerSession();
    }, 0);

    plannerPollId = window.setInterval(() => {
      void refreshPlannerSession();
    }, 4000);

    return () => {
      window.clearTimeout(initialPollId);
      if (plannerPollId) {
        window.clearInterval(plannerPollId);
      }
    };
  }, [isGroupChat, refreshPlannerSession, thread]);

  useEffect(() => {
    if (!plannerSession || !isGroupChat || plannerSession.status !== "completed") {
      return;
    }

    const storageKey = `zymix-planner-celebrated:${plannerSession.id}`;
    const hasBeenCelebrated = window.sessionStorage.getItem(storageKey) === "1";
    const celebrationTimer = window.setTimeout(() => {
      if (!hasBeenCelebrated) {
        window.sessionStorage.setItem(storageKey, "1");
        setCelebratedSessionId(plannerSession.id);
        return;
      }

      setCelebratedSessionId(null);
    }, 0);

    return () => {
      window.clearTimeout(celebrationTimer);
    };
  }, [plannerSession, isGroupChat]);

  const activePlannerSessionId = plannerSession?.id ?? null;
  const activePlannerStatus = plannerSession?.status ?? null;

  useEffect(() => {
    const readTimer = window.setTimeout(() => {
      if (!isGroupChat || !activePlannerSessionId || activePlannerStatus !== "completed") {
        setIsPlannerMinimized(false);
        return;
      }

      setIsPlannerMinimized(window.sessionStorage.getItem(getPlannerStorageKey(activePlannerSessionId)) === "1");
    }, 0);

    return () => {
      window.clearTimeout(readTimer);
    };
  }, [activePlannerSessionId, activePlannerStatus, isGroupChat]);

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
      await refreshPlannerSession();
    } catch (sendError) {
      markFailedMessage(pendingId, sendError instanceof Error ? sendError.message : "Unable to send your message.");
    } finally {
      setIsSending(false);
    }
  }

  async function submitPlannerCriteria(payload: CriteriaSubmitPayload) {
    if (!thread || !persona) {
      return;
    }

    setIsSubmittingCriteria(true);
    setPlannerActionError(null);

    try {
      const nextSession = await postPlannerCriteria(thread.threadId, payload);
      if (nextSession) {
        setPlannerSession(nextSession);
      }
      setPlannerError(null);
      await refreshPlannerSession();
    } catch (criteriaError) {
      setPlannerActionError(criteriaError instanceof Error ? criteriaError.message : "Failed to submit planner criteria.");
    } finally {
      setIsSubmittingCriteria(false);
    }
  }

  async function submitPlannerVote(bucketItemIds: string[]) {
    if (!thread || !persona) {
      return;
    }

    setIsSubmittingVote(true);
    setPlannerActionError(null);

    try {
      const nextSession = await postPlannerVote(thread.threadId, bucketItemIds);
      if (nextSession) {
        setPlannerSession(nextSession);
      }
      setPlannerError(null);
      await refreshPlannerSession();
    } catch (voteError) {
      setPlannerActionError(voteError instanceof Error ? voteError.message : "Failed to submit planner vote.");
    } finally {
      setIsSubmittingVote(false);
    }
  }

  async function cancelPlannerSession() {
    if (!thread || !persona) {
      return;
    }

    setIsCanceling(true);
    setPlannerActionError(null);

    try {
      const nextSession = await postPlannerCancel(thread.threadId);
      if (nextSession) {
        setPlannerSession(nextSession);
      }
      setPlannerError(null);
      await refreshPlannerSession();
    } catch (plannerCancelError) {
      setPlannerActionError(plannerCancelError instanceof Error ? plannerCancelError.message : "Failed to cancel planner.");
    } finally {
      setIsCanceling(false);
    }
  }

  async function removePlannerSession() {
    if (!thread || !persona || !plannerSession || isRemovingPlanner) {
      return;
    }

    const removedSessionId = plannerSession.id;
    setIsRemovingPlanner(true);
    setPlannerActionError(null);

    try {
      await deletePlannerSession(thread.threadId);
      window.sessionStorage.removeItem(getPlannerStorageKey(removedSessionId));
      window.sessionStorage.removeItem(`zymix-planner-celebrated:${removedSessionId}`);
      setPlannerSession(null);
      setCelebratedSessionId(null);
      setIsPlannerMinimized(false);
      setPlannerError(null);
    } catch (plannerRemoveError) {
      const message = plannerRemoveError instanceof Error ? plannerRemoveError.message : "Failed to remove planner.";
      setPlannerActionError(message);
      setPlannerError(message);
    } finally {
      setIsRemovingPlanner(false);
    }
  }

  function confirmPlannerSession() {
    if (!plannerSession || plannerSession.status !== "completed") {
      return;
    }

    window.sessionStorage.setItem(getPlannerStorageKey(plannerSession.id), "1");
    setIsPlannerMinimized(true);
  }

  function expandPlannerSession() {
    if (!plannerSession) {
      return;
    }

    window.sessionStorage.removeItem(getPlannerStorageKey(plannerSession.id));
    setIsPlannerMinimized(false);
  }

  const isTesterPersona = personaId === "tester";
  const isParticipant = Boolean(personaId && plannerSession?.participants.includes(personaId));
  const hasSubmittedCriteria = Boolean(personaId ? plannerSession?.criteriaByUserId?.[personaId] : false);
  const hasSubmittedVotes = Boolean(personaId ? plannerSession?.votesByUserId?.[personaId] : false);
  const canRemovePlanner = Boolean(isGroupChat && isParticipant && !isTesterPersona && plannerSession?.status === "completed");
  const canCancelPlanner = Boolean(
    isGroupChat &&
      isParticipant &&
      !isTesterPersona &&
      plannerSession &&
      (plannerSession.status === "collecting" || plannerSession.status === "voting")
  );
  const showCriteriaOverlay = Boolean(
    isGroupChat &&
      isParticipant &&
      !isTesterPersona &&
      plannerSession?.status === "collecting" &&
      !hasSubmittedCriteria
  );
  const showVotingOverlay = Boolean(
    isGroupChat &&
      isParticipant &&
      !isTesterPersona &&
      plannerSession?.status === "voting" &&
      !hasSubmittedVotes
  );
  const showCelebration = Boolean(celebratedSessionId && plannerSession && plannerSession.id === celebratedSessionId);

  if (isLoading) {
    return <LoadingState />;
  }

  if (sessionError) {
    return <ErrorState message={sessionError} />;
  }

  if (!thread) {
    return <ErrorState message="This chat is unavailable for the current persona." />;
  }

  if (!personaId) {
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
      plannerSession={isGroupChat ? plannerSession : null}
      plannerError={isGroupChat ? plannerError : null}
      isGroupChat={isGroupChat}
      showCelebration={showCelebration}
      currentPersonaId={personaId!}
      canCancel={canCancelPlanner}
      showCriteriaOverlay={showCriteriaOverlay}
      showVotingOverlay={showVotingOverlay}
      onSubmitCriteria={(payload) => {
        return submitPlannerCriteria(payload);
      }}
      onSubmitVote={(bucketItemIds) => {
        return submitPlannerVote(bucketItemIds);
      }}
      onCancelPlanner={() => {
        return cancelPlannerSession();
      }}
      isSubmittingCriteria={isSubmittingCriteria}
      isSubmittingVote={isSubmittingVote}
      isCanceling={isCanceling}
      criteriaError={isGroupChat && !isTesterPersona ? plannerActionError : null}
      voteError={isGroupChat && !isTesterPersona ? plannerActionError : null}
      cancelError={isGroupChat && !isTesterPersona && canCancelPlanner ? plannerActionError : null}
      isPlannerMinimized={isPlannerMinimized}
      onConfirmPlanner={confirmPlannerSession}
      onExpandPlanner={expandPlannerSession}
      onRemovePlanner={canRemovePlanner ? removePlannerSession : undefined}
      isRemovingPlanner={isRemovingPlanner}
    />
  );
}
