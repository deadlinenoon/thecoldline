// Known or expected international/neutral site games for 2025 season.
// If schedule data marks neutral sites via provider, this table will be
// supplemented automatically at build time. Left empty until confirmed.
export type InternationalGame = {
  week: number;
  home: string;
  away: string;
  venue: string;
  city: string;
  lat: number;
  lon: number;
  note: string;
};

export const INTERNATIONAL_2025: InternationalGame[] = [];

export default INTERNATIONAL_2025;

