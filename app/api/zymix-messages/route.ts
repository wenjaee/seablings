import { NextRequest, NextResponse } from "next/server";

import { getCurrentPersona } from "@/lib/server/auth";
import { jsonError, readJsonBody, statusForError } from "@/lib/server/http";
import { getBackendStore } from "@/lib/server/store";
import { parseCreateZymixMessageInput, parseZymixMessageFilters } from "@/lib/server/validation";

export async function GET(request: NextRequest) {
  const persona = await getCurrentPersona(request.cookies);
  if (!persona) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const filters = parseZymixMessageFilters(request.nextUrl.searchParams);
    const store = getBackendStore();
    const messages = await store.listZymixMessages(filters);

    return NextResponse.json({
      messages,
      count: messages.length,
      mode: store.mode
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to list Zymix messages.", statusForError(error));
  }
}

export async function POST(request: NextRequest) {
  const persona = await getCurrentPersona(request.cookies);
  if (!persona) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const body = await readJsonBody(request);
    const input = parseCreateZymixMessageInput(body);
    const store = getBackendStore();
    const message = await store.createZymixMessage(persona.id, input);

    return NextResponse.json(
      {
        message,
        mode: store.mode
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create Zymix message.", statusForError(error));
  }
}
