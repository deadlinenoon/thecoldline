import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MetricsAccordion from '@/components/metrics/MetricsAccordion';

const sampleData = {
  count: 2,
  hfa: { base: 1.5, delta: -0.2 },
  total: 1.3,
  categories: [
    {
      key: 'Env',
      label: 'Environment',
      subtotal: 0.7,
      items: [
        { key: 'env', label: 'Wind', value: 0.3 },
        { key: 'rain', label: 'Rain', value: 0.4 },
      ],
    },
  ],
};

test('renders metrics summary with controls', () => {
  const markup = renderToStaticMarkup(<MetricsAccordion data={sampleData as any} />);
  assert(markup.includes('active metrics'));
  assert(markup.includes('Expand all'));
  assert(markup.includes('Environment'));
});
