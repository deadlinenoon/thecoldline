import { getOddsApiKey } from "../../lib/odds/env";

export function withApiKey(inputUrl: string): { url: string; init: RequestInit } {
  const init: RequestInit = { headers: {} };
  let url = inputUrl;
  const apiKey = getOddsApiKey();
  if (apiKey) {
    (init.headers as Record<string, string>)["x-api-key"] = apiKey;
  } else {
    // Some providers accept apikey query; only append if we truly have a key
    const u = new URL(url);
    // do not append empty apikey
    url = u.toString();
  }
  return { url, init };
}

export default withApiKey;
