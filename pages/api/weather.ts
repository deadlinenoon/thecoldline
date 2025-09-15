import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // Temporary stub so builds succeed while we rewire stadium/team imports.
  res.status(200).json({ ok: true, data: [], note: "weather endpoint temporarily disabled" });
}
