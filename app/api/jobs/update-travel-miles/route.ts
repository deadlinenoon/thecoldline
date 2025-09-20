import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'update travel miles job not implemented' }, { status: 501 });
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
