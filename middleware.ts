import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/api/ping", "/api/odds", "/login"]; // routes that must bypass auth
const RAW_CANONICAL_HOSTS = (process.env.CANONICAL_HOSTS || "www.thecoldline.com,thecoldline.com")
  .split(",")
  .map(host => host.trim())
  .filter(Boolean);
const CANONICAL_HOSTS = RAW_CANONICAL_HOSTS.map(host => host.toLowerCase());
const FALLBACK_HOST = RAW_CANONICAL_HOSTS[0] ?? "www.thecoldline.com";
const NON_CANONICAL_HOSTS = [
  "thecoldline-edztfxf7x-deadlinenoons-projects.vercel.app",
];

const PUBLIC_MODE_ENABLED = (() => {
  const raw = process.env.PUBLIC_MODE;
  if (raw === undefined) return true;
  return /^(true|1|yes|on)$/i.test(raw);
})();

const isLocalHost = (host: string) => {
  const normalized = host.toLowerCase();
  return (
    normalized.startsWith("localhost") ||
    normalized.startsWith("127.") ||
    normalized.endsWith(".local") ||
    normalized === ""
  );
};

function redirectToCanonical(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host") || "";
  const normalizedHost = host.toLowerCase();
  if (isLocalHost(host) || CANONICAL_HOSTS.includes(normalizedHost)) return null;

  const needsRedirect =
    NON_CANONICAL_HOSTS.includes(normalizedHost) || normalizedHost.endsWith(".vercel.app");

  if (!needsRedirect) return null;

  const url = req.nextUrl.clone();
  url.protocol = "https";
  url.hostname = FALLBACK_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export function middleware(req: NextRequest) {
  const canonicalRedirect = redirectToCanonical(req);
  if (canonicalRedirect) return canonicalRedirect;

  if (PUBLIC_MODE_ENABLED) {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("tcl_sess");
  if (!sessionCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.protocol = "https";
    if (!CANONICAL_HOSTS.includes(loginUrl.hostname.toLowerCase())) {
      loginUrl.hostname = FALLBACK_HOST;
      loginUrl.port = "";
    }
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl, 307);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|assets).*)"] };
