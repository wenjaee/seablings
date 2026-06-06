import clsx from "clsx";
import { Bot, MapPinned } from "lucide-react";

import type { PersonaId } from "@/lib/domain";
import type { DemoTimelineMessage } from "@/lib/demo/data";
import { formatTime, getPersona } from "@/lib/demo/data";

type ChatThreadProps = {
  currentPersonaId: PersonaId;
  messages: DemoTimelineMessage[];
};

export function ChatThread({ currentPersonaId, messages }: ChatThreadProps) {
  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const isPlanner = message.userId === "planner";
        const persona = message.userId !== "planner" ? getPersona(message.userId) : null;
        const isCurrentPersona = message.userId === currentPersonaId;

        return (
          <article
            key={message.id}
            className={clsx(
              "flex",
              isPlanner ? "justify-start" : isCurrentPersona ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={clsx(
                "max-w-[88%] rounded-lg px-4 py-3",
                isPlanner && message.stage === "result" && "bg-[var(--ink)] text-white",
                isPlanner && message.stage !== "result" && "bg-[#eef3ff] text-[var(--ink)]",
                !isPlanner && isCurrentPersona && "text-white",
                !isPlanner && !isCurrentPersona && "bg-[#eef2f0] text-[var(--ink)]"
              )}
              style={!isPlanner && isCurrentPersona && persona ? { backgroundColor: persona.color } : undefined}
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
                {isPlanner ? (
                  <>
                    <Bot size={13} aria-hidden="true" />
                    Planner
                  </>
                ) : persona ? (
                  <>
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                    {persona.name}
                  </>
                ) : null}
                <span>{formatTime(message.createdAt)}</span>
              </div>

              <p className="text-sm leading-6">{message.text}</p>

              {isPlanner && message.stage === "result" ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                  <MapPinned size={13} aria-hidden="true" />
                  Ready to share back into chat
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
