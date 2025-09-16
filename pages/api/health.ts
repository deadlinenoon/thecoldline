import type { NextApiRequest, NextApiResponse } from "next";
import { HAVE } from "../../lib/env";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    return res.status(200).json({ ok: true, env: { odds: HAVE.ODDS, upstash: HAVE.UPSTASH } });
  } catch (e: any) {
    return res.status(200).json({ ok: false, env: { odds: false, upstash: false }, error: e?.message || "health error" });
  }
}
