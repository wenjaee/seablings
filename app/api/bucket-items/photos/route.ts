import { NextRequest, NextResponse } from "next/server";

import { jsonError, readJsonBody, requireCaptureBearerAuth, statusForError } from "@/lib/server/http";
import { enrichPlacePhotoWithPerplexity } from "@/lib/server/providers";
import { getBackendStore } from "@/lib/server/store";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

type BackfillBody = {
  limit?: unknown;
  dryRun?: unknown;
};

export async function POST(request: NextRequest) {
  const authError = requireCaptureBearerAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const body = (await readJsonBody(request)) as BackfillBody;
    const limit = normalizeLimit(body.limit);
    const dryRun = body.dryRun === true;
    const store = getBackendStore();
    const savedItems = await store.listBucketItems({ status: "saved" });
    const candidates = savedItems.filter((item) => !item.photoUrl).slice(0, limit);

    if (dryRun) {
      return NextResponse.json({
        dryRun,
        candidates: candidates.map((item) => ({
          id: item.id,
          title: item.title,
          locationName: item.locationName,
          neighborhood: item.neighborhood
        })),
        count: candidates.length,
        mode: store.mode
      });
    }

    const results = [];
    for (const item of candidates) {
      const photo = await enrichPlacePhotoWithPerplexity({
        title: item.title,
        locationName: item.locationName,
        neighborhood: item.neighborhood,
        address: item.address,
        websiteUrl: item.websiteUrl
      });

      if (!photo?.photoUrl) {
        results.push({ id: item.id, title: item.title, updated: false });
        continue;
      }

      const updated = await store.updateBucketItemPhoto(item.id, photo);
      results.push({
        id: item.id,
        title: item.title,
        updated: Boolean(updated?.photoUrl),
        photoUrl: updated?.photoUrl,
        photoSourceLinks: updated?.photoSourceLinks ?? []
      });
    }

    return NextResponse.json({
      dryRun,
      count: results.length,
      updated: results.filter((result) => result.updated).length,
      results,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to backfill bucket item photos.", statusForError(error));
  }
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value)));
}
