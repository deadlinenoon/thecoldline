import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminRequest } from '@/lib/admin/auth';
import { loadAnalyticsTrends } from '@/lib/analytics/dashboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const trends = await loadAnalyticsTrends();
    return res.status(200).json(trends);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'analytics trends error' });
  }
}
