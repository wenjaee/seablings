import { NextRequest, NextResponse } from "next/server";

import { getCurrentPersona } from "@/lib/server/auth";
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
    const persona = await getCurrentPersona(request.cookies);
    if (!persona) {
      return jsonError("Unauthorized.", 401);
    }

    const body = await readJsonBody(request);
    const status = parseBucketItemStatus(body);
    const store = getBackendStore();
    const existingItem = await store.getBucketItemById(id);
    if (!existingItem) {
      return jsonError("Bucket item not found.", 404);
    }

    if (existingItem.userId !== persona.id) {
      return jsonError("Cannot update another persona's bucket item.", 403);
    }

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
