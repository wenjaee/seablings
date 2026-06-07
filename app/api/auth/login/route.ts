import { NextRequest, NextResponse } from "next/server";

import {
  authenticateDemoPersona,
  createDemoSessionValue,
  getDemoSessionCookieName,
  getDemoSessionMaxAgeSeconds
} from "@/lib/server/auth";
import { jsonError, readJsonBody, statusForError } from "@/lib/server/http";
import { parseDemoLoginInput } from "@/lib/server/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const { personaId, pin } = parseDemoLoginInput(body);
    const persona = await authenticateDemoPersona(personaId, pin);

    if (!persona) {
      return jsonError("Invalid personaId or PIN.", 401);
    }

    const response = NextResponse.json({ persona });
    response.cookies.set({
      name: getDemoSessionCookieName(),
      value: await createDemoSessionValue(persona.id),
      httpOnly: true,
      maxAge: getDemoSessionMaxAgeSeconds(),
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to log in.", statusForError(error));
  }
}
