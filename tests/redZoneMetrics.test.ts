import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import RedZoneBar from '../src/components/metrics/RedZoneBar';
import { normalizeSegments, deriveOffenseBreakdown } from '../src/lib/metrics/redzone';

function testNormalizeSegments() {
  const result = normalizeSegments({ td: 0.7, fg: 0.25, to: -0.05, fail: 0.2 }, ['td', 'fg', 'to', 'fail']);
  const total = result.td + result.fg + result.to + result.fail;
  assert.ok(Math.abs(total - 1) < 1e-9, 'normalized segments should sum to 1');
  assert.ok(result.to === 0, 'negative inputs clamp to zero');
  assert.ok(result.td > result.fg, 'relative proportions preserved after normalization');
}

function testDeriveOffenseBreakdown() {
  const breakdown = deriveOffenseBreakdown({ td: 0.61, fg: 0.22, turnover: 0.05 });
  assert.ok(Math.abs(breakdown.fail - 0.12) < 1e-6, 'residual fail share matches expected 12%');
  const sum = breakdown.td + breakdown.fg + breakdown.to + breakdown.fail;
  assert.ok(Math.abs(sum - 1) < 1e-9, 'derived offense breakdown sums to 1');
}

function testRedZoneBarRendering() {
  const markup = renderToStaticMarkup(
    React.createElement(RedZoneBar, {
      title: 'Sample Red Zone Offense',
      ariaLabel: 'Red Zone Offense breakdown',
      segments: [
        { key: 'td', label: 'Touchdown', value: 0.61, color: '#16a34a' },
        { key: 'fg', label: 'Field Goal', value: 0.22, color: '#eab308' },
        { key: 'fail', label: 'Failed attempt', value: 0.12, color: '#f97316' },
        { key: 'to', label: 'Turnover', value: 0.05, color: '#ef4444' },
      ],
    })
  );
  const segmentCount = (markup.match(/data-testid="red-zone-segment-/g) || []).length;
  assert.strictEqual(segmentCount, 4, 'renders four stacked segments');
  assert.ok(markup.includes('61%'), 'outputs percent labels for large segments');
  assert.ok(!markup.includes('No Red Zone data'), 'does not show empty-state when segments present');
}

function run() {
  testNormalizeSegments();
  testDeriveOffenseBreakdown();
  testRedZoneBarRendering();
  console.log('redZoneMetrics tests passed');
}

run();

