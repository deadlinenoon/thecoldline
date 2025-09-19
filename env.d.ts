declare namespace NodeJS {
  interface ProcessEnv {
    // Upstash KV (preferred)
    UPSTASH_REDIS_REST_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;
    // Legacy KV compat (fallback)
    KV_REST_API_URL?: string;
    KV_REST_API_TOKEN?: string;

    // Third-party APIs
    OPENWEATHERMAP_API_KEY?: string;
    ODDS_API_KEY?: string;
    ODDS_API_KEY_2?: string;
    OPENAI_API_KEY?: string;
    BALLDONTLIE_ALL_ACCESS_KEY?: string;
    BALLDONTLIE_ALL_ACCESS_BASE_URL?: string;
    ALLSPORTS_API_KEY?: string;
    ALLSPORTS_API_BASE?: string;

    // Public exposure keys (Next.js)
    NEXT_PUBLIC_BALLEDONTLIE_KEY?: string;
    NEXT_PUBLIC_BALLEDONTLIE_BASE_URL?: string;
    NEXT_PUBLIC_ALLSPORTS_KEY?: string;
    NEXT_PUBLIC_ALLSPORTS_BASE_URL?: string;

    // Convex
    CONVEX_DEPLOY_KEY?: string;
    NEXT_PUBLIC_CONVEX_URL?: string;

    // ScoresAndOdds scraping
    SAO_USER_AGENT?: string;
    SAO_SCRAPE_URL?: string;

    // Email + admin
    SENDGRID_API_KEY?: string;
    SENDGRID_FROM?: string;
    ADMIN_EMAIL?: string;
    ADMIN_PASSWORD?: string;
    ADMIN_PWHASH?: string;
    ADMIN_SALT?: string;
    AUTH_SECRET?: string;
    INVITE_CODE?: string;
    INVITES_OPEN?: string;
    INVITES_ALLOW_USERS?: string;
    WHITELIST?: string;
    DATA_DIR?: string;
  }
}
