import { NextRequest, NextResponse } from "next/server";

import { jsonError, statusForError } from "@/lib/server/http";
import { getBackendStore } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const store = getBackendStore();
    const result = await store.drainQueue(limit);

    return NextResponse.json({
      ...result,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to drain queue.", statusForError(error));
  }
}
