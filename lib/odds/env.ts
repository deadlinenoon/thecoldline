export function getOddsApiKey(): string | null {
  return process.env.ODDS_API_KEY || process.env.ODDS_API_KEY_2 || null;
}
export function oddsKeyAvailable(): boolean {
  return !!getOddsApiKey();
}

