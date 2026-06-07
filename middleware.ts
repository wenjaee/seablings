import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentPersona } from "@/lib/server/auth";

export async function middleware(request: NextRequest) {
  const persona = await getCurrentPersona(request.cookies);
  if (persona) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/me", "/me/bucket-list", "/me/bucket-list/:path*", "/bucket-list", "/chat/:path*"]
};
