"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Mic, MoreHorizontal, Plus, Send, Sticker } from "lucide-react";

import { Avatar } from "@/components/zymix/avatar";
import type { AvatarSpec, ThreadData, ThreadMessage } from "@/lib/zymix/data";

const ME_AVATAR: AvatarSpec = { kind: "checker" };

export function GroupChat({ thread }: { thread: ThreadData }) {
  const [messages, setMessages] = useState<ThreadMessage[]>(thread.messages);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = draft.trim();
    if (!text) {
      return;
    }

    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

    setMessages((prev) => [
      ...prev,
      {
        id: `me-${prev.length}-${now.getTime()}`,
        kind: "message",
        authorId: "me",
        authorName: "inajeffyy",
        avatar: ME_AVATAR,
        text,
        time,
        mine: true
      }
    ]);
    setDraft("");
  }

  const hasDraft = draft.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-1">
        <Link
          href="/"
          aria-label="Back"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-black/5 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.10)]"
        >
          <ArrowLeft size={22} />
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--zx-brand)] px-1 text-[11px] font-bold leading-none text-white">
            3
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-center gap-2.5">
          <Avatar spec={thread.avatar} size={36} />
          <div>
            <p className="text-[17px] font-semibold leading-tight text-[var(--zx-ink)]">{thread.name}</p>
            <p className="text-[13px] leading-tight text-[var(--zx-muted)]">{thread.members} Members</p>
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

        {messages.map((message) =>
          message.kind === "system" ? (
            <p key={message.id} className="py-2 text-center text-[13px] text-[var(--zx-muted)]">
              {message.text}
            </p>
          ) : message.mine ? (
            <div key={message.id} className="mb-3 flex justify-end">
              <div className="flex max-w-[78%] items-end gap-2 rounded-2xl rounded-tr-md bg-[var(--zx-brand)] px-3.5 py-2">
                <span className="text-[15px] leading-snug text-white">{message.text}</span>
                <span className="shrink-0 text-[11px] leading-snug text-white/75">{message.time}</span>
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
        <div ref={endRef} />
      </div>

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
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
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
              aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--zx-brand)] text-white shadow-[0_4px_14px_rgba(53,201,60,0.45)]"
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
    </div>
  );
}
