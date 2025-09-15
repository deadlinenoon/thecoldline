(() => {
  const required = ['AUTH_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];
  const missing = required.filter(k => !process.env[k] || String(process.env[k]).trim()==='');
  if (missing.length) {
    throw new Error(`Missing required envs: ${missing.join(', ')}`);
  }
})();

