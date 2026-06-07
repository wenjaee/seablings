import { NextRequest, NextResponse } from "next/server";

import { buildPlannerIcsEvent, resolvePlannerEventStart } from "@/lib/planner/calendar";
import { getCurrentPersona } from "@/lib/server/auth";
import { jsonError, statusForError } from "@/lib/server/http";
import { getBackendStore } from "@/lib/server/store";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  isPlannerParticipantId,
  parsePlannerSessionFilters
} from "@/lib/server/validation";
import type { BucketItem, PlannerSession } from "@/lib/domain";

export async function GET(request: NextRequest) {
  const persona = await getCurrentPersona(request.cookies);
  if (!persona) {
    return jsonError("Unauthorized.", 401);
  }

  if (!isPlannerParticipantId(persona.id)) {
    return jsonError("Only Jeff, Praya, and Tana can view planner sessions.", 403);
  }

  try {
    const filters = parsePlannerSessionFilters(request.nextUrl.searchParams);
    const store = getBackendStore();
    const session = await store.getLatestPlannerSession(filters.threadId);

    if (!session) {
      throw new NotFoundError("No planner session found for this thread.");
    }

    if (!session.participants.includes(persona.id)) {
      throw new AuthorizationError("Only planner participants can add this plan to a calendar.");
    }

    if (session.status !== "completed") {
      throw new ConflictError("Planner session is not completed.");
    }

    const winningItems = getWinningItems(session);
    if (winningItems.length === 0) {
      throw new NotFoundError("Planner session has no winning item.");
    }

    const title = `SEAblings plan: ${winningItems.map((item) => item.title).join(" + ")}`;
    const location = winningItems.map(getItemLocation).filter(Boolean).join(" + ");
    const proposedTime = session.finalPlan?.proposedTime ?? session.proposedTime ?? null;
    const start = resolvePlannerEventStart(proposedTime);
    const description = [
      "SEAblings planner confirmed this plan.",
      proposedTime ? `When: ${proposedTime}` : null,
      winningItems.map((item) => `- ${item.title}${getItemLocation(item) ? ` (${getItemLocation(item)})` : ""}`).join("\n")
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
    const calendar = buildPlannerIcsEvent({
      title,
      start,
      durationMins: 120,
      location,
      description,
      uid: `${session.id}@seablings.local`
    });

    return new NextResponse(calendar, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="seablings-plan.ics"'
      }
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to build planner calendar.",
      statusForPlannerError(error)
    );
  }
}

function getWinningItems(session: PlannerSession): BucketItem[] {
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
    .filter((item): item is BucketItem => Boolean(item));
}

function getItemLocation(item: BucketItem): string {
  return item.locationName ?? item.neighborhood ?? "";
}

function statusForPlannerError(error: unknown): number {
  if (error instanceof AuthorizationError) {
    return 403;
  }

  if (error instanceof NotFoundError) {
    return 404;
  }

  if (error instanceof ConflictError) {
    return 409;
  }

  return statusForError(error);
}
