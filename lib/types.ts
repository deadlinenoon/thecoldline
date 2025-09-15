export type Venue = {
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  roof: "Open-air" | "Domed";
  international: boolean;
};

export type Game = {
  season: number;
  week: number;
  home: string;
  away: string;
  game_date_local: string;
  venue_id: string;
};

export type TravelRow = {
  season: number;
  week: number;
  team: string;
  opponent: string;
  game_date_local: string;
  site_type: "home" | "away" | "international";
  stadium_name: string;
  stadium_city: string;
  stadium_country: string;
  stadium_roof: "Open-air" | "Domed";
  home_stadium: string;
  home_lat: number;
  home_lon: number;
  origin_lat: number;
  origin_lon: number;
  dest_lat: number;
  dest_lon: number;
  leg_miles: number;
  miles_since_last_home: number;
  ytd_miles: number;
  notes?: string;
};

export type YtdRow = {
  team: string;
  ytd_miles: number;
  miles_since_last_home: number;
  last_week_played: number;
};

