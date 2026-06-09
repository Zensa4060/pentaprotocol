/**
 * Profile badges / titles — mirrors web ProfileScreen TITLES.
 */

import type { User } from "@/lib/types";

export interface TitleDef {
  id: string;
  label: string;
  color: string;
  unlockDesc: string;
  condition: (u: User) => boolean;
}

export const PROFILE_TITLES: TitleDef[] = [
  { id: "newcomer", label: "Newcomer", color: "#9CA3AF", unlockDesc: "Default title", condition: () => true },
  { id: "rookie", label: "Rookie", color: "#6B7280", unlockDesc: "Play 5 matches", condition: (p) => p.wins + p.losses + p.draws >= 5 },
  { id: "sharpshooter", label: "Sharpshooter", color: "#60A5FA", unlockDesc: "Win 10 matches", condition: (p) => p.wins >= 10 },
  { id: "duelist", label: "Duelist", color: "#FCD34D", unlockDesc: "Win 25 matches", condition: (p) => p.wins >= 25 },
  { id: "rising_star", label: "Rising Star", color: "#93C5FD", unlockDesc: "Reach 500 ELO", condition: (p) => (p.elo ?? 0) >= 500 },
  { id: "gladiator", label: "Gladiator", color: "#F97316", unlockDesc: "Win 50 matches", condition: (p) => p.wins >= 50 },
  { id: "strategist", label: "Strategist", color: "#34D399", unlockDesc: "Reach 1000 ELO", condition: (p) => (p.elo ?? 0) >= 1000 },
  { id: "ironbound", label: "Ironbound", color: "#78716C", unlockDesc: "Win 75 matches", condition: (p) => p.wins >= 75 },
  { id: "apex", label: "Apex", color: "#2DD4BF", unlockDesc: "Reach level 30", condition: (p) => p.level >= 30 },
  { id: "centurion", label: "Centurion", color: "#C084FC", unlockDesc: "Win 100 matches", condition: (p) => p.wins >= 100 },
  { id: "breaker", label: "Breaker", color: "#F87171", unlockDesc: "10 Rulebreaker wins", condition: (p) => p.rb_wins >= 10 },
  { id: "protocol", label: "Protocol", color: "#38BDF8", unlockDesc: "Reach level 20", condition: (p) => p.level >= 20 },
  { id: "emerald_eye", label: "Emerald Eye", color: "#10B981", unlockDesc: "Reach 1500 ELO", condition: (p) => (p.elo ?? 0) >= 1500 },
  { id: "unbreakable", label: "Unbreakable", color: "#FB7185", unlockDesc: "3+ Rulebreaker wins", condition: (p) => p.rb_wins >= 3 },
  { id: "warlord", label: "Warlord", color: "#DC2626", unlockDesc: "Win 150 matches", condition: (p) => p.wins >= 150 },
  { id: "veteran", label: "Veteran", color: "#A78BFA", unlockDesc: "Play 200 games", condition: (p) => p.wins + p.losses + p.draws >= 200 },
  { id: "chaos_agent", label: "Chaos Agent", color: "#F97316", unlockDesc: "30 Rulebreaker wins", condition: (p) => p.rb_wins >= 30 },
  { id: "architect", label: "Architect", color: "#E879F9", unlockDesc: "Reach level 50", condition: (p) => p.level >= 50 },
  { id: "penta_master", label: "Penta Master", color: "#FF3333", unlockDesc: "Reach 2000 ELO", condition: (p) => (p.elo ?? 0) >= 2000 },
  { id: "conqueror", label: "Conqueror", color: "#D97706", unlockDesc: "Win 200 matches", condition: (p) => p.wins >= 200 },
  { id: "relentless", label: "Relentless", color: "#4ADE80", unlockDesc: "Play 500 games", condition: (p) => p.wins + p.losses + p.draws >= 500 },
  { id: "sovereign", label: "Sovereign", color: "#7C3AED", unlockDesc: "Win 300 matches", condition: (p) => p.wins >= 300 },
  { id: "the_legend", label: "The Legend", color: "#F59E0B", unlockDesc: "Reach 2500 ELO", condition: (p) => (p.elo ?? 0) >= 2500 },
  { id: "ascendant", label: "Ascendant", color: "#818CF8", unlockDesc: "Reach level 100", condition: (p) => p.level >= 100 },
  { id: "immortal", label: "Immortal", color: "#BAE6FD", unlockDesc: "Win 500 matches", condition: (p) => p.wins >= 500 },
  { id: "transcendent", label: "Transcendent", color: "#F0ABFC", unlockDesc: "Reach level 300", condition: (p) => p.level >= 300 },
];
