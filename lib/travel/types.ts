export type TravelRow = {
  team: string;
  week: number;
  opponent: string;
  home_away: "H" | "A" | "N" | string;
  game_city: string;
  game_lat: number;
  game_lon: number;
  distance_from_prev_location_mi: number;
  miles_since_last_home: number;
  cumulative_miles: number;
  note?: string;
};

