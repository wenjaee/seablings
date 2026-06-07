import type { MemberProgress } from "@/lib/planner/types";

export function WaitingBox({
  title,
  members,
  doneLabel,
  isDone
}: {
  title: string;
  members: MemberProgress[];
  doneLabel: string;
  isDone: (member: MemberProgress) => boolean;
}) {
  const doneCount = members.filter(isDone).length;

  return (
    <div className="my-2 rounded-2xl border border-[var(--zx-line)] bg-[var(--zx-surface)] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[14px] font-bold text-[var(--zx-ink)]">{title}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[12px] font-bold"
          style={{ background: "var(--zx-brand)", color: "var(--zx-brand-deep)" }}
        >
          {doneCount} / {members.length}
        </span>
      </div>
      {members.map((member) => {
        const done = isDone(member);
        return (
          <div key={member.userId} className="flex items-center gap-2 py-0.5 text-[13px] text-[var(--zx-muted)]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: done ? "var(--zx-brand)" : "var(--zx-line)" }}
            />
            {member.name} — {done ? doneLabel : "pending"}
          </div>
        );
      })}
    </div>
  );
}
