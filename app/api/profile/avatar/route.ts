import { NextResponse } from "next/server";
export async function GET() {
  // No avatar persistence wired in App Router yet; return 204 so callers fall back gracefully.
  return new Response(null, { status: 204 });
}
export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json({ error: "invalid content type" }, { status: 400 });
    }
    const body = await req.json();
    return NextResponse.json({ ok: true, received: body });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
