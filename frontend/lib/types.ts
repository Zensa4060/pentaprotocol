export type Screen =
  | "home" | "auth" | "policy_gate" | "lobby" | "game" | "aiGame" | "multiGame"
  | "profile" | "rules" | "ai" | "singleplayer" | "store" | "collection" | "career" | "battlepass";

export type BoardMode = "5x5" | "6x6" | "7x7";


export interface MatchupData {
  opponent: {
    name: string;
    elo: number | null;
    avatar: string | null;
    banner: string;
    level: number;
  };
}