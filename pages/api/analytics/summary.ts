import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminRequest } from '@/lib/admin/auth';
import { loadAnalyticsSummary } from '@/lib/analytics/dashboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const summary = await loadAnalyticsSummary();
    return res.status(200).json(summary);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'analytics summary error' });
  }
}
