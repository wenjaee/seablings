import { NextRequest, NextResponse } from "next/server";

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

    return NextResponse.json({
      session,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load planner session.",
      statusForPlannerError(error)
    );
  }
}

export async function DELETE(request: NextRequest) {
  const persona = await getCurrentPersona(request.cookies);
  if (!persona) {
    return jsonError("Unauthorized.", 401);
  }

  if (!isPlannerParticipantId(persona.id)) {
    return jsonError("Only Jeff, Praya, and Tana can remove planner sessions.", 403);
  }

  try {
    const filters = parsePlannerSessionFilters(request.nextUrl.searchParams);
    const store = getBackendStore();
    await store.deleteLatestPlannerSession(filters.threadId, persona.id);

    return NextResponse.json({
      session: null,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to remove planner session.",
      statusForPlannerError(error)
    );
  }
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
