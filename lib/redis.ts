export async function rget(key: string) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  const url = `${base}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return json?.result ? JSON.parse(json.result) : null;
}

export async function rsetex(key: string, ttlSec: number, val: unknown) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return;
  const body = JSON.stringify(val);
  const url = `${base}/setex/${encodeURIComponent(key)}/${ttlSec}/${encodeURIComponent(body)}`;
  await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}
