export type Screen =
  | "home" | "auth" | "lobby" | "game" | "aiGame" | "multiGame"
  | "profile" | "rules" | "ai" | "store" | "collection" | "career" | "battlepass";

export interface MatchupData {
  opponent: {
    name: string;
    elo: number | null;
    avatar: string | null;
    banner: string;
    level: number;
  };
}