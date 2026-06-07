import { NextRequest, NextResponse } from "next/server";

import { getCurrentPersona } from "@/lib/server/auth";
import { jsonError, readJsonBody, statusForError } from "@/lib/server/http";
import { getBackendStore } from "@/lib/server/store";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  isPlannerParticipantId,
  parseSubmitPlannerCriteriaInput
} from "@/lib/server/validation";

export async function POST(request: NextRequest) {
  const persona = await getCurrentPersona(request.cookies);
  if (!persona) {
    return jsonError("Unauthorized.", 401);
  }

  if (!isPlannerParticipantId(persona.id)) {
    return jsonError("Only Jeff, Praya, and Tana can submit planner criteria.", 403);
  }

  try {
    const body = await readJsonBody(request);
    const input = parseSubmitPlannerCriteriaInput(body);
    const store = getBackendStore();
    const session = await store.submitPlannerCriteria(input.threadId, persona.id, input);

    return NextResponse.json({
      session,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to submit planner criteria.",
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
