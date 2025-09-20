import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET as metricsGET } from '../app/api/metrics/route';

globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    gameId: 'X',
    categories: [
      {
        key: 'Env',
        label: 'Environment',
        items: [{ key: 'env_wind', label: 'Wind', value: -0.12 }],
      },
    ],
  }),
}) as any;

test('normalizes metrics and counts items', async () => {
  const req = new NextRequest('http://x/api/metrics?home=KC&away=BAL');
  const res = await metricsGET(req as any);
  const body = await res.json();
  assert.equal(body.count, 1);
  assert.equal(body.categories[0].items[0].label, 'Wind');
});
