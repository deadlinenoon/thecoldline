import { NextResponse } from 'next/server';
import { bdlBase } from '@/lib/bdl';
import { getAllAccessConfig } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  const { apiKey } = getAllAccessConfig();
  return NextResponse.json({
    ok: Boolean(apiKey),
    base: bdlBase(),
    hasKey: Boolean(apiKey),
  });
}
