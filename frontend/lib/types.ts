export type Screen =
  | "home" | "auth" | "policy_gate" | "lobby" | "game" | "aiGame" | "multiGame"
  | "profile" | "rules" | "patchNotes" | "ai" | "singleplayer" | "store" | "collection" | "career" | "battlepass";

export type SetScreenOptions = {
  /** After a finished match, avoid leaving multiGame on the browser history stack so Back does not return to the board. */
  exitMultiGameToCareer?: boolean;
};

export type BoardMode = "5x5" | "6x6" | "7x7" | "5x5_7x7" | "5x5_6x6" | "6x6_7x7" | "5x5_6x6_7x7";


export interface MatchupData {
  opponent: {
    name: string;
    elo: number | null;
    avatar: string | null;
    banner: string;
    level: number;
    placement_matches?: number;
  };
}