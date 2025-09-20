import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Allow', 'GET');
  return res.status(405).json({ error: 'Not implemented' });
}
