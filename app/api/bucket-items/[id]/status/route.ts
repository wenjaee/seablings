import { NextRequest, NextResponse } from "next/server";

import { jsonError, readJsonBody, statusForError } from "@/lib/server/http";
import { getBackendStore } from "@/lib/server/store";
import { parseBucketItemStatus } from "@/lib/server/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const status = parseBucketItemStatus(body);
    const store = getBackendStore();
    const item = await store.updateBucketItemStatus(id, status);

    if (!item) {
      return jsonError("Bucket item not found.", 404);
    }

    return NextResponse.json({
      item,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to update bucket item status.",
      statusForError(error)
    );
  }
}
