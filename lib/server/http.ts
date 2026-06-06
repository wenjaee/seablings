import { NextResponse } from "next/server";

import { ValidationError } from "@/lib/server/validation";

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}

export function requireCaptureBearerAuth(request: Request): NextResponse | null {
  const configuredToken = process.env.SEA_CAPTURE_BEARER_TOKEN?.trim();

  if (!configuredToken) {
    return null;
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${configuredToken}`) {
    return null;
  }

  return NextResponse.json(
    { error: "Unauthorized", hint: "Send Authorization: Bearer <SEA_CAPTURE_BEARER_TOKEN>." },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": "Bearer"
      }
    }
  );
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function statusForError(error: unknown, validationStatus = 400, serverStatus = 500): number {
  return error instanceof ValidationError ? validationStatus : serverStatus;
}
