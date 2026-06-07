import { NextRequest, NextResponse } from "next/server";

import { getCurrentPersona } from "@/lib/server/auth";
import { jsonError, statusForError } from "@/lib/server/http";
import { getBackendStore } from "@/lib/server/store";
import { parseThreadIdList } from "@/lib/server/validation";

export async function GET(request: NextRequest) {
  const persona = await getCurrentPersona(request.cookies);
  if (!persona) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const threadIds = parseThreadIdList(request.nextUrl.searchParams.get("threadIds"));
    const store = getBackendStore();
    const latest = await store.getLatestZymixMessages(threadIds);

    return NextResponse.json({
      latest,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load chat summary.", statusForError(error));
  }
}
