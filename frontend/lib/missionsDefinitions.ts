import type { MissionMatchEvent, RewardPlaceholder } from "./missionsClient";
import { formatDateKeyLocal } from "./missionsClient";

export type MissionPeriod = "daily" | "weekly" | "permanent";

export type ProgressKind =
  | "rankedWins"
  | "unrankedWins"
  | "rulebreakerWins"
  | "hardBotWins"
  | "botWins"
  | "totalWins"
  | "totalMatches"
  | "higherEloWins"
  | "streakRankedMax"
  | "levelAtLeast"
  | "rankAtLeast"
  | "rankedWinsTotalAtLeast"
  | "totalWinsAtLeast"
  | "rankedMatchesAtLeast"
  | "rulebreakerWinsRanked";

export type RankKey = "advanced" | "professional" | "emerald" | "master" | "legend";

export type MissionDef = {
  id: string;
  period: MissionPeriod;
  title: string;
  description: string;
  shards: number;
  progress: { kind: ProgressKind; target: number; rank?: RankKey };
  rewards?: RewardPlaceholder[]; // permanent missions only (placeholders, currently unused)
  /**
   * One-off hero reward shown for a specific permanent mission (e.g. the
   * CHRONICLE rank mission grants a free theme of choice). When set, the UI
   * promotes the mission to the top and renders it with a golden treatment.
   */
  specialReward?: { label: string; description?: string };
  // Optional grouping metadata for UI
  difficulty?: "easy" | "medium" | "hard";
};

const RANK_THRESHOLDS: Record<RankKey, number> = {
  advanced: 500,
  professional: 1000,
  emerald: 1500,
  master: 2000,
  legend: 2500,
};

function countEvents(events: MissionMatchEvent[], predicate: (e: MissionMatchEvent) => boolean) {
  let c = 0;
  for (const e of events) if (predicate(e)) c++;
  return c;
}

function maxRankedWinStreak(events: MissionMatchEvent[]) {
  let cur = 0;
  let best = 0;
  // events already expected sorted by `at`, but we keep it safe
  const sorted = [...events].sort((a, b) => a.at - b.at);
  for (const e of sorted) {
    if (e.matchKind !== "ranked") continue;
    if (e.result === "win") {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

export function computeMissionProgress(args: {
  mission: MissionDef;
  events: MissionMatchEvent[];
  profile: Record<string, unknown>;
}) {
  const { mission, events, profile } = args;
  const kind = mission.progress.kind;
  const target = mission.progress.target;

  const winsOnly = (e: MissionMatchEvent) => e.result === "win";

  switch (kind) {
    case "rankedWins":
      return countEvents(events, e => e.matchKind === "ranked" && winsOnly(e));
    case "unrankedWins":
      return countEvents(events, e => e.matchKind === "unranked" && winsOnly(e));
    case "rulebreakerWins":
      return countEvents(events, e => winsOnly(e) && e.rulebreakerUsed);
    case "hardBotWins":
      return countEvents(events, e => e.matchKind === "bot" && winsOnly(e) && e.botDifficulty === "hard");
    case "botWins":
      return countEvents(events, e => e.matchKind === "bot" && winsOnly(e));
    case "totalWins":
      return countEvents(events, e => winsOnly(e));
    case "totalMatches":
      return events.length;
    case "higherEloWins":
      return countEvents(events, e => winsOnly(e) && typeof e.opponentElo === "number" && typeof e.myElo === "number" && (e.opponentElo as number) > (e.myElo as number));
    case "rulebreakerWinsRanked":
      return countEvents(events, e => e.matchKind === "ranked" && winsOnly(e) && e.rulebreakerUsed);
    case "streakRankedMax":
      return maxRankedWinStreak(events);
    case "levelAtLeast":
      return Math.min(mission.progress.target, Number(profile["level"] ?? 1));
    case "rankAtLeast": {
      const elo = Number(profile["elo"] ?? 0);
      const thr = mission.progress.rank ? RANK_THRESHOLDS[mission.progress.rank] : 999999;
      return elo >= thr ? target : 0;
    }
    case "rankedWinsTotalAtLeast":
      return countEvents(events, e => e.matchKind === "ranked" && e.result === "win");
    case "totalWinsAtLeast":
      return countEvents(events, e => e.result === "win");
    case "rankedMatchesAtLeast":
      return countEvents(events, e => e.matchKind === "ranked");
    default:
      return 0;
  }
}

function hashStringToSeed(input: string) {
  // tiny deterministic hash (must match backend app.core.mission_xp)
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic mission XP; 0 if mission id is not a known prefix (daily / weekly / permanent). */
export function missionXpForMissionId(missionId: string): number {
  // CHRONICLE rank mission is the capstone goal — big XP payout + free theme.
  if (missionId === "perm_rank_legend") return 200000;
  const h = hashStringToSeed(missionId);
  if (missionId.startsWith("d_")) return 250;
  if (missionId.startsWith("w_")) return 2500;
  if (missionId.startsWith("perm_")) return 500 + (h % 9501);
  return 0;
}

function seededRandom(seed: number) {
  // xorshift32
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 0xffffffff);
  };
}

function pickShuffled<T>(arr: T[], count: number, seedStr: string) {
  const seed = hashStringToSeed(seedStr);
  const rnd = seededRandom(seed);
  const copy = [...arr];
  // Fisher-Yates shuffle
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function pickRandom<T>(arr: T[], count: number) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

type RotationState = { periodKey: string; ids: string[] };
const rotationKey = (period: "daily" | "weekly", userKey: string) => `pp_mission_rotation_${period}_${userKey}`;

function loadRotationState(period: "daily" | "weekly", userKey: string): RotationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(rotationKey(period, userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RotationState;
    if (!parsed || typeof parsed.periodKey !== "string" || !Array.isArray(parsed.ids)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveRotationState(period: "daily" | "weekly", userKey: string, state: RotationState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(rotationKey(period, userKey), JSON.stringify(state));
}

function getRotatingMissionIds(args: {
  period: "daily" | "weekly";
  periodKey: string;
  userKey: string;
  poolIds: string[];
  count: number;
}) {
  const { period, periodKey, userKey, poolIds, count } = args;
  const prev = loadRotationState(period, userKey);

  // Same period: keep stable selection.
  if (prev?.periodKey === periodKey && prev.ids.length > 0) {
    return prev.ids.slice(0, count);
  }

  const previousIds = new Set(prev?.ids ?? []);
  let candidates = poolIds.filter((id) => !previousIds.has(id));
  if (candidates.length < count) candidates = [...poolIds];

  const nextIds = pickRandom(candidates, count);
  saveRotationState(period, userKey, { periodKey, ids: nextIds });
  return nextIds;
}

// ── Mission Pools ────────────────────────────────────────────────────────────

export const DAILY_MISSION_POOL: MissionDef[] = [
  // 1..4: directly from user examples / common daily goals
  { id: "d_ranked_wins_2", period: "daily", title: "Win 2 ranked matches", description: "Get 2 wins in ranked play.", shards: 10, progress: { kind: "rankedWins", target: 2 }, difficulty: "easy" },
  { id: "d_rulebreaker_wins_1", period: "daily", title: "Win 1 rulebreaker series", description: "Win a series that reached rulebreaker (Game 3).", shards: 10, progress: { kind: "rulebreakerWins", target: 1 }, difficulty: "easy" },
  { id: "d_hardbot_wins_1", period: "daily", title: "Win 1 hard bot match", description: "Beat the hard bot difficulty.", shards: 10, progress: { kind: "hardBotWins", target: 1 }, difficulty: "medium" },
  { id: "d_total_wins_3", period: "daily", title: "Win 3 matches", description: "Any mode counts as long as you win.", shards: 10, progress: { kind: "totalWins", target: 3 }, difficulty: "easy" },

  // More daily variations (to reach 15)
  { id: "d_unranked_wins_2", period: "daily", title: "Win 2 exhibition matches", description: "Get 2 wins in unranked play.", shards: 10, progress: { kind: "unrankedWins", target: 2 }, difficulty: "easy" },
  { id: "d_total_wins_5", period: "daily", title: "Win 5 matches", description: "Rack up 5 wins today.", shards: 10, progress: { kind: "totalWins", target: 5 }, difficulty: "medium" },
  { id: "d_ranked_wins_3", period: "daily", title: "Win 3 ranked matches", description: "3 ranked wins in one day.", shards: 10, progress: { kind: "rankedWins", target: 3 }, difficulty: "medium" },
  { id: "d_ranked_rulebreaker_wins_2", period: "daily", title: "Win 2 ranked rulebreaker series", description: "Rulebreaker series in ranked + wins.", shards: 10, progress: { kind: "rulebreakerWinsRanked", target: 2 }, difficulty: "hard" },
  { id: "d_bot_wins_2", period: "daily", title: "Win 2 bot matches", description: "Win any 2 bot matches.", shards: 10, progress: { kind: "botWins", target: 2 }, difficulty: "medium" },
  { id: "d_higher_elo_wins_1", period: "daily", title: "Beat a higher elo", description: "Win once against a higher elo opponent.", shards: 10, progress: { kind: "higherEloWins", target: 1 }, difficulty: "medium" },
  { id: "d_streak_ranked_2", period: "daily", title: "Ranked winstreak x2", description: "Achieve a 2-win streak in ranked.", shards: 10, progress: { kind: "streakRankedMax", target: 2 }, difficulty: "easy" },
  { id: "d_total_matches_3", period: "daily", title: "Play 3 matches", description: "Complete 3 matches today (any mode).", shards: 10, progress: { kind: "totalMatches", target: 3 }, difficulty: "easy" },
  { id: "d_total_wins_2", period: "daily", title: "Win 2 matches", description: "Quick wins today.", shards: 10, progress: { kind: "totalWins", target: 2 }, difficulty: "easy" },
  { id: "d_rulebreaker_wins_2", period: "daily", title: "Win 2 rulebreaker series", description: "Win 2 series that reached rulebreaker.", shards: 10, progress: { kind: "rulebreakerWins", target: 2 }, difficulty: "hard" },
  { id: "d_ranked_wins_4", period: "daily", title: "Win 4 ranked matches", description: "Climb with 4 ranked wins.", shards: 10, progress: { kind: "rankedWins", target: 4 }, difficulty: "hard" },
];

export const WEEKLY_MISSION_POOL: MissionDef[] = [
  { id: "w_ranked_wins_15", period: "weekly", title: "Win 15 ranked matches", description: "Go hard in ranked. 15 wins this week.", shards: 100, difficulty: "hard", progress: { kind: "rankedWins", target: 15 } },
  { id: "w_higher_elo_wins_2", period: "weekly", title: "Beat higher elo (x2)", description: "Win 2 games against higher elo opponents.", shards: 75, difficulty: "medium", progress: { kind: "higherEloWins", target: 2 } },
  { id: "w_total_wins_10", period: "weekly", title: "Win 10 matches total", description: "Any wins count for this weekly quest.", shards: 60, difficulty: "easy", progress: { kind: "totalWins", target: 10 } },
  { id: "w_rulebreaker_wins_5", period: "weekly", title: "Win 5 rulebreaker series", description: "Win 5 rulebreaker series (Game 3).", shards: 80, difficulty: "hard", progress: { kind: "rulebreakerWins", target: 5 } },
  { id: "w_ranked_wins_12", period: "weekly", title: "Win 12 ranked matches", description: "Earn 12 ranked wins this week.", shards: 90, difficulty: "hard", progress: { kind: "rankedWins", target: 12 } },
  { id: "w_total_matches_25", period: "weekly", title: "Play 25 matches", description: "Complete 25 matches across any mode.", shards: 70, difficulty: "medium", progress: { kind: "totalMatches", target: 25 } },
  { id: "w_streak_ranked_5", period: "weekly", title: "Ranked winstreak x5", description: "Hit a 5-win streak in ranked this week.", shards: 85, difficulty: "hard", progress: { kind: "streakRankedMax", target: 5 } },
  { id: "w_rulebreaker_ranked_4", period: "weekly", title: "Win 4 ranked rulebreaker series", description: "Secure 4 ranked wins in rulebreaker series.", shards: 95, difficulty: "hard", progress: { kind: "rulebreakerWinsRanked", target: 4 } },
];

export function getDailyMissionIds(date: Date, userKey: string): string[] {
  const dateKey = formatDateKeyLocal(date);
  const ids = DAILY_MISSION_POOL.map(m => m.id);
  if (typeof window === "undefined") return pickShuffled(ids, 4, `daily:${dateKey}`);
  return getRotatingMissionIds({ period: "daily", periodKey: dateKey, userKey, poolIds: ids, count: 4 });
}

export function getWeeklyMissionIds(weekStart: Date, userKey: string): string[] {
  const weekKey = formatDateKeyLocal(weekStart);
  const ids = WEEKLY_MISSION_POOL.map(m => m.id);
  if (typeof window === "undefined") return pickShuffled(ids, 4, `weekly:${weekStart.getTime()}`);
  return getRotatingMissionIds({ period: "weekly", periodKey: weekKey, userKey, poolIds: ids, count: 4 });
}

const LEVEL_THRESHOLDS: number[] = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 125, 150, 180, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];

const RANK_MISSIONS: { key: RankKey; id: string; displayName: string }[] = [
  { key: "advanced",     id: "perm_rank_advanced",     displayName: "SKILLED" },
  { key: "professional", id: "perm_rank_professional", displayName: "ELITE" },
  { key: "emerald",      id: "perm_rank_emerald",      displayName: "MYTHIC" },
  { key: "master",       id: "perm_rank_master",       displayName: "CRACKED" },
  { key: "legend",       id: "perm_rank_legend",       displayName: "CHRONICLE" },
];

const RANKED_WIN_THRESHOLDS = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500];
const TOTAL_WIN_THRESHOLDS = [20, 40, 60, 80, 100, 150, 200];
const RANKED_PLAY_THRESHOLDS = [25, 50, 100, 150, 200, 300];

export function getPermanentMissionDefs(): MissionDef[] {
  const defs: MissionDef[] = [];

  for (const lvl of LEVEL_THRESHOLDS) {
    const shards = Math.min(250, Math.max(15, Math.round(lvl / 4)));
    defs.push({
      id: `perm_level_${lvl}`,
      period: "permanent",
      title: `Reach level ${lvl}`,
      description: `Level up to ${lvl} for a permanent XP + shards reward.`,
      shards,
      progress: { kind: "levelAtLeast", target: lvl },
      difficulty: lvl <= 50 ? "easy" : lvl <= 200 ? "medium" : "hard",
    });
  }

  for (const r of RANK_MISSIONS) {
    let shards = r.key === "legend" ? 260 : r.key === "master" ? 240 : r.key === "emerald" ? 220 : 200;
    if (r.id === "perm_rank_legend") shards = 10000;

    const isLegend = r.id === "perm_rank_legend";
    defs.push({
      id: r.id,
      period: "permanent",
      title: `Reach ${r.displayName} rank`,
      description: isLegend
        ? `Climb all the way to ${r.displayName} — the apex rank. Capstone reward: free theme of your choice.`
        : `Achieve the ${r.displayName} rank threshold.`,
      shards,
      progress: { kind: "rankAtLeast", target: RANK_THRESHOLDS[r.key], rank: r.key },
      difficulty: isLegend ? "hard" : "medium",
      specialReward: isLegend
        ? { label: "FREE THEME OF CHOICE", description: "Unlock any theme in the game as a permanent reward." }
        : undefined,
    });
  }

  // Winstreak: user requested "get a 10 ranked winstreak"
  defs.push({
    id: "perm_ranked_winstreak_10",
    period: "permanent",
    title: "Ranked winstreak x10",
    description: "Achieve a 10-win ranked streak (max consecutive wins).",
    shards: 320,
    progress: { kind: "streakRankedMax", target: 10 },
    difficulty: "hard",
  });

  // Ranked wins totals
  for (const n of RANKED_WIN_THRESHOLDS) {
    const shards = Math.min(260, Math.max(20, Math.round(n * 1.8)));
    defs.push({
      id: `perm_ranked_wins_${n}`,
      period: "permanent",
      title: `Win ${n} ranked matches`,
      description: `Accumulate ${n} ranked wins total.`,
      shards,
      progress: { kind: "rankedWinsTotalAtLeast", target: n },
      difficulty: n <= 50 ? "easy" : n <= 200 ? "medium" : "hard",
    });
  }

  for (const n of TOTAL_WIN_THRESHOLDS) {
    const shards = Math.min(240, Math.max(20, Math.round(n * 1.4)));
    defs.push({
      id: `perm_total_wins_${n}`,
      period: "permanent",
      title: `Win ${n} matches total`,
      description: `Accumulate ${n} wins across any mode.`,
      shards,
      progress: { kind: "totalWinsAtLeast", target: n },
      difficulty: n <= 100 ? "easy" : "medium",
    });
  }

  for (const n of RANKED_PLAY_THRESHOLDS) {
    const shards = Math.min(220, Math.max(20, Math.round(n * 1.1)));
    defs.push({
      id: `perm_ranked_play_${n}`,
      period: "permanent",
      title: `Play ${n} ranked matches`,
      description: `Complete ${n} ranked matches total.`,
      shards,
      progress: { kind: "rankedMatchesAtLeast", target: n },
      difficulty: n <= 100 ? "easy" : "medium",
    });
  }

  return defs;
}

export function missionDefById(id: string): MissionDef | undefined {
  const daily = DAILY_MISSION_POOL.find(m => m.id === id);
  if (daily) return daily;
  const weekly = WEEKLY_MISSION_POOL.find(m => m.id === id);
  if (weekly) return weekly;
  const perm = getPermanentMissionDefs().find(m => m.id === id);
  if (perm) return perm;
  return undefined;
}

export function getAllMissionDefsByPeriod(): Record<MissionPeriod, MissionDef[]> {
  return {
    daily: DAILY_MISSION_POOL,
    weekly: WEEKLY_MISSION_POOL,
    permanent: getPermanentMissionDefs(),
  };
}

