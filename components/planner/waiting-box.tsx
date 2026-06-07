import { type PlannerMemberProgress } from "@/lib/planner/types";

type WaitingMember = PlannerMemberProgress & {
  isDone?: boolean;
};

export function PlannerWaitingBox({
  title,
  members,
  doneLabel,
  isDone
}: {
  title: string;
  members: WaitingMember[];
  doneLabel: string;
  isDone?: (member: WaitingMember) => boolean;
}) {
  const isDoneFn = isDone ?? ((member: WaitingMember) => Boolean(member.respondedCriteria || member.voted || member.isDone));
  const doneCount = members.filter(isDoneFn).length;

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
        const completed = isDoneFn(member);
        return (
          <div key={member.userId} className="flex min-w-0 items-center gap-2 py-0.5 text-[13px] text-[var(--zx-muted)]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: completed ? "var(--zx-brand)" : "var(--zx-line)" }}
            />
            <span className="min-w-0 flex-1 break-words">
              {member.name} — {completed ? doneLabel : "pending"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { PlannerWaitingBox as WaitingBox };
