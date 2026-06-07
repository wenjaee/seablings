import { NextRequest, NextResponse } from "next/server";

import { getCurrentPersona } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const persona = await getCurrentPersona(request.cookies);

  if (!persona) {
    return jsonError("Unauthorized.", 401);
  }

  return NextResponse.json({ persona });
}
