import type { NextApiRequest, NextApiResponse } from 'next';
import { isAdminRequest } from '@/lib/admin/auth';
import { loadAnalyticsDetail } from '@/lib/analytics/dashboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const rawDays = Number(req.query.days ?? 14);
    const days = Math.max(1, Math.min(30, Number.isFinite(rawDays) ? Number(rawDays) : 14));
    const detail = await loadAnalyticsDetail(days, 25);
    return res.status(200).json(detail);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'analytics detail error' });
  }
}
