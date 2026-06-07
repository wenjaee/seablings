import { NextRequest, NextResponse } from "next/server";

import { matchDemoSeed } from "@/lib/server/demo-seeds";
import { jsonError, readJsonBody, requireCaptureBearerAuth, statusForError } from "@/lib/server/http";
import { runIngestionPipeline } from "@/lib/server/ingestion-pipeline";
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

    // Demo short-circuit: a matched capture (e.g. the DakaDaka TikTok) inserts a
    // hand-curated, fully-enriched item instead of running the live pipeline.
    const demoSeed = matchDemoSeed(payload);
    if (demoSeed) {
      await store.updateCaptureTaskStatus(task.id, "processing");
      await store.updateCaptureTaskStatus(task.id, "enriching");
      const seededItem = await store.createBucketItem(demoSeed.buildItem(payload));
      const completedTask = await store.updateCaptureTaskStatus(task.id, "completed");

      return NextResponse.json(
        {
          task: completedTask ?? task,
          item: seededItem,
          items: [seededItem],
          pipeline: { places: 1, embeddings: 0, mode: "demo-seed", usedFallback: false },
          mode: store.mode
        },
        { status: 201 }
      );
    }

    await store.updateCaptureTaskStatus(task.id, "processing");
    await store.updateCaptureTaskStatus(task.id, "extracting");
    await store.updateCaptureTaskStatus(task.id, "enriching");

    try {
      const pipeline = await runIngestionPipeline(payload);
      if (pipeline.places.length === 0) {
        await store.updateCaptureTaskStatus(task.id, "failed");
        return jsonError("No visitable places found in this capture.", 422);
      }

      await store.updateCaptureTaskStatus(task.id, "embedding");

      const items = [];
      let embeddingCount = 0;
      for (const place of pipeline.places) {
        const item = await store.createBucketItem({
          ...place.bucketItem,
          userId: payload.userId,
          status: "saved",
          sourceType: payload.sourceType,
          sourceUrl: place.bucketItem.sourceUrl ?? payload.sourceUrl
        });

        if (place.embedding && !place.embedding.skipped) {
          await store.saveBucketItemEmbedding({
            bucketItemId: item.id,
            values: place.embedding.values,
            text: place.embedding.text,
            model: place.embedding.model,
            dimensions: place.embedding.dimensions,
            contentHash: place.embedding.contentHash
          });
          embeddingCount += 1;
        }

        items.push(item);
      }

      const completedTask = await store.updateCaptureTaskStatus(task.id, "completed");

      return NextResponse.json(
        {
          task: completedTask ?? task,
          item: items[0],
          items,
          pipeline: {
            places: items.length,
            embeddings: embeddingCount,
            mode: pipeline.mode,
            usedFallback: pipeline.usedFallback
          },
          mode: store.mode
        },
        { status: 201 }
      );
    } catch (pipelineError) {
      await store.updateCaptureTaskStatus(task.id, "failed").catch(() => null);
      return jsonError(
        pipelineError instanceof Error ? pipelineError.message : "Failed to process capture through provider pipeline.",
        statusForError(pipelineError, 422, 502)
      );
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create capture task.", statusForError(error));
  }
}
