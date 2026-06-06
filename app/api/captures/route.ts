import { NextRequest, NextResponse } from "next/server";

import { jsonError, readJsonBody, requireCaptureBearerAuth, statusForError } from "@/lib/server/http";
import { getBackendStore } from "@/lib/server/store";
import { parseCaptureFilters, parseCapturePayload } from "@/lib/server/validation";

export async function GET(request: NextRequest) {
  try {
    const filters = parseCaptureFilters(request.nextUrl.searchParams);
    const store = getBackendStore();
    const tasks = await store.listCaptures(filters);

    return NextResponse.json({
      tasks,
      count: tasks.length,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to list captures.", statusForError(error));
  }
}

export async function POST(request: NextRequest) {
  const authError = requireCaptureBearerAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await readJsonBody(request);
    const payload = parseCapturePayload(body);
    const store = getBackendStore();
    const task = await store.createCaptureTask(payload);

    return NextResponse.json(
      {
        task,
        hint: {
          processing: "queued",
          nextStatus: "completed",
          candidateStatus: "candidate",
          drainPath: "/api/queue/drain",
          mode: store.mode
        }
      },
      { status: 202 }
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create capture task.", statusForError(error));
  }
}
