"use client";

import { useState } from "react";

import { CelebrationOverlay } from "@/components/planner/celebration-overlay";
import { ConfirmedPlanCard } from "@/components/planner/confirmed-plan-card";
import { CriteriaDialog } from "@/components/planner/criteria-dialog";
import { usePlanner } from "@/components/planner/planner-provider";
import { VotingDialog } from "@/components/planner/voting-dialog";
import { WaitingBox } from "@/components/planner/waiting-box";

/**
 * Bottom-sheet dialog shown "above the keyboard" — criteria collection while
 * collecting, voting once recommendations are ready. Returns null when the
 * local user has nothing to do (they're waiting on others).
 */
export function PlannerDock() {
  const { snapshot, submitMyCriteria, castMyVote } = usePlanner();
  if (!snapshot) {
    return null;
  }

  const { session, myCriteriaSubmitted, myVoteSubmitted, recommendations, proposedTime, proposedStartIso } =
    snapshot;

  if (session.status === "collecting" && !myCriteriaSubmitted) {
    return (
      <div key="criteria" className="planner-sheet-in px-2 pt-2">
        <CriteriaDialog onSubmit={submitMyCriteria} />
      </div>
    );
  }

  if (session.status === "voting" && !myVoteSubmitted) {
    return (
      <div key="voting" className="planner-sheet-in px-2 pt-2">
        <VotingDialog
          proposedTime={proposedTime}
          proposedStartIso={proposedStartIso}
          recommendations={recommendations}
          onCast={castMyVote}
        />
      </div>
    );
  }

  return null;
}

/** In-thread cards: live waiting boxes and the final confirmed plan. */
export function PlannerThread() {
  const { snapshot } = usePlanner();
  if (!snapshot) {
    return null;
  }

  const { session, members, myCriteriaSubmitted, myVoteSubmitted, winners, proposedTime, proposedStartIso } = snapshot;

  return (
    <>
      {session.status === "collecting" && myCriteriaSubmitted ? (
        <WaitingBox
          title="Waiting for responses"
          members={members}
          doneLabel="responded"
          isDone={(member) => member.respondedCriteria}
        />
      ) : null}

      {session.status === "voting" && myVoteSubmitted ? (
        <WaitingBox title="Waiting for votes" members={members} doneLabel="voted" isDone={(member) => member.voted} />
      ) : null}

      {session.status === "completed"
        ? winners.map((winner) => (
            <ConfirmedPlanCard
              key={winner.bucketItemId}
              winner={winner}
              proposedTime={proposedTime}
              proposedStartIso={proposedStartIso}
            />
          ))
        : null}
    </>
  );
}

/** Full-screen celebration that fires once when voting closes. */
export function PlannerCelebration() {
  const { snapshot } = usePlanner();
  const [dismissed, setDismissed] = useState(false);

  const completed = snapshot?.session.status === "completed";
  if (!snapshot || !completed || dismissed || snapshot.winners.length === 0) {
    return null;
  }

  return (
    <CelebrationOverlay
      winners={snapshot.winners}
      proposedTime={snapshot.proposedTime}
      onDismiss={() => setDismissed(true)}
    />
  );
}
