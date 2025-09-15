export const HAVE = {
  ODDS: !!process.env.ODDS_API_KEY,
  UPSTASH: !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
};

