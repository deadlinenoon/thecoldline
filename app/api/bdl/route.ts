import { NextResponse } from 'next/server';
import { bdl } from '@/lib/bdl';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await bdl<{ data: any[] }>('/teams');
    return NextResponse.json({
      ok: true,
      count: Array.isArray(data?.data) ? data.data.length : 0,
      sample: Array.isArray(data?.data) ? data.data.slice(0, 5) : [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('BDL teams error', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
