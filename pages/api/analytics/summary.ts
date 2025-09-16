import type { NextApiRequest, NextApiResponse } from "next";
import { getKV } from "../../../lib/kv";
import { kHits, kSignups, kRef, kPath, dstr } from "../../../lib/analytics/keys";

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const kv = await getKV();
  const today = dstr();
  const days7 = Array.from({length:7}, (_,i)=>dstr(daysAgo(i)));
  const days30 = Array.from({length:30},(_,i)=>dstr(daysAgo(i)));

  async function sum(keys: string[]) {
    let s = 0;
    for (const k of keys) s += await kv.getNum(k);
    return s;
  }

  const todayHits = await kv.getNum(kHits(today));
  const todaySignups = await kv.getNum(kSignups(today));
  const hits7 = await sum(days7.map(kHits));
  const signups7 = await sum(days7.map(kSignups));
  const hits30 = await sum(days30.map(kHits));
  const signups30 = await sum(days30.map(kSignups));
  const topRef = await kv.ztop(kRef(today), 10);
  const topPath = await kv.ztop(kPath(today), 10);

  res.status(200).json({
    today: { hits: todayHits, signups: todaySignups },
    last7: { hits: hits7, signups: signups7 },
    last30: { hits: hits30, signups: signups30 },
    topReferrersToday: topRef.map((t: any) => ({ ref: String(t[0]), hits: Number(t[1]) })),
    topPathsToday: topPath.map((t: any) => ({ path: String(t[0]), hits: Number(t[1]) })),
  });
}
