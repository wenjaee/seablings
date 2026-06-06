import { NextRequest, NextResponse } from "next/server";

import { jsonError, readJsonBody, statusForError } from "@/lib/server/http";
import { getBackendStore } from "@/lib/server/store";
import { parseBucketItemFilters, parseManualBucketItemInput } from "@/lib/server/validation";

export async function GET(request: NextRequest) {
  try {
    const filters = parseBucketItemFilters(request.nextUrl.searchParams);
    const store = getBackendStore();
    const items = await store.listBucketItems(filters);

    return NextResponse.json({
      items,
      count: items.length,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to list bucket items.", statusForError(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const input = parseManualBucketItemInput(body);
    const store = getBackendStore();
    const item = await store.createBucketItem(input);

    return NextResponse.json(
      {
        item,
        mode: store.mode
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create bucket item.", statusForError(error));
  }
}
