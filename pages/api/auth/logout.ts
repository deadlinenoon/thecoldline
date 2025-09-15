import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Set-Cookie', 'tcl_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return res.status(200).json({ ok: true });
}

