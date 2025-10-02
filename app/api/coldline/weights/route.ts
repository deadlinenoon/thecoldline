import { NextResponse } from 'next/server';
import { loadColdLineWeights } from '@/lib/coldline/weights';

export async function GET() {
  try {
    const weights = await loadColdLineWeights();
    const payload = Array.from(weights.values()).map(weight => ({
      metric: weight.metric,
      averageEffectPoints: weight.averageEffectPoints,
      coldLineAdjustment: weight.coldLineAdjustment,
      epaPerPlayDelta: weight.epaPerPlayDelta,
      winProbabilityDelta: weight.winProbabilityDelta,
      atsCoverDelta: weight.atsCoverDelta,
      significance: weight.significance,
    }));
    return NextResponse.json({ ok: true, weights: payload }, {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[api/coldline/weights] failed', error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
