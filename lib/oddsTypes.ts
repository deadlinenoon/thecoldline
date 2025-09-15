// Shared types for odds API payloads to avoid importing from pages/api.

export type Outcome = { name: string; point?: number; price?: number };
export type Market = { key: string; outcomes: Outcome[] };
export type Book = { title: string; markets: Market[] };
export type Event = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Book[];
};

