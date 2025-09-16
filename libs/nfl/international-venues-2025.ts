// International/neutral sites for 2025.
// Leave empty by default; when announced, add entries that match either by
// week+teams or by gameId to override location to a neutral site.
// When a match occurs, travel rows will mark note = "Neutral site" and use
// the specified lat/lon and city.

export type IntlVenue = {
  week: number;
  gameId?: string;
  city: string;
  lat: number;
  lon: number;
  home_team?: string;
  away_team?: string;
  note: string;
};

const INTERNATIONAL_2025: IntlVenue[] = [];

export default INTERNATIONAL_2025;

