import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = ["/api/ping", "/api/odds"];

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (PUBLIC.some(x => p === x || p.startsWith(x))) return NextResponse.next();
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|assets).*)"] };
