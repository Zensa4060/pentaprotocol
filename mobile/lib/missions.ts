/**
 * Missions — daily / weekly / permanent, mirroring the web
 * (``frontend/lib/missionsDefinitions.ts``). Mission ids keep the
 * backend prefixes so claims validate (``backend/app/core/mission_xp.py``
 * accepts any ``d_`` / ``w_`` / ``perm_`` id; XP = 250 / 2500 / 500–10000).
 *
 * Progress sources:
 *   - permanent : authoritative profile counters (wins / level / elo).
 *   - daily / weekly : the user's recent match history
 *     (``GET /api/profile/career``) filtered to the current period.
 *
 * BETA OFFER (new): 2 of the 4 weekly missions advertise **+50
 * ProtoCredits**. The existing ``claim-mission`` endpoint only grants
 * XP/shards, so the PC won't actually credit until a backend endpoint
 * exists — the UI labels this clearly.
 */

import API from "@/lib/api";
import { ApiError } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import type { CareerMatch, User } from "@/lib/types";
import { isAxiosError } from "axios";

export type MissionPeriod = "daily" | "weekly" | "permanent";

export interface ProgressCtx {
  user: User;
  winsToday: number;
  matchesToday: number;
  winsThisWeek: number;
  matchesThisWeek: number;
}

export interface MissionDef {
  id: string;
  period: MissionPeriod;
  title: string;
  description: string;
  /** XP/shards reward copy shown on the card. */
  rewardLabel: string;
  target: number;
  /** Beta launch offer: ProtoCredits advertised (pending backend credit). */
  betaProtoCredits?: number;
  progress: (ctx: ProgressCtx) => number;
}

export interface MissionView extends MissionDef {
  value: number;
  complete: boolean;
}

// ── Permanent (profile-derived) ──────────────────────────────────────────────
const PERMANENT: MissionDef[] = [
  { id: "perm_total_wins_10", period: "permanent", title: "First Strides", description: "Win 10 games total.", rewardLabel: "XP", target: 10, progress: (c) => c.user.wins },
  { id: "perm_total_wins_50", period: "permanent", title: "Seasoned", description: "Win 50 games total.", rewardLabel: "XP", target: 50, progress: (c) => c.user.wins },
  { id: "perm_total_wins_100", period: "permanent", title: "Centurion", description: "Win 100 games total.", rewardLabel: "XP", target: 100, progress: (c) => c.user.wins },
  { id: "perm_level_5", period: "permanent", title: "Level 5", description: "Reach account level 5 (unlocks ranked).", rewardLabel: "XP", target: 5, progress: (c) => c.user.level },
  { id: "perm_level_25", period: "permanent", title: "Level 25", description: "Reach account level 25.", rewardLabel: "XP", target: 25, progress: (c) => c.user.level },
  { id: "perm_rank_master", period: "permanent", title: "Cracked", description: "Reach CRACKED (2000 ELO).", rewardLabel: "XP", target: 2000, progress: (c) => c.user.elo ?? 0 },
  { id: "perm_rank_legend", period: "permanent", title: "Chronicle", description: "Reach CHRONICLE (2500 ELO) — huge reward.", rewardLabel: "XP + Shards", target: 2500, progress: (c) => c.user.elo ?? 0 },
];

// ── Daily (rotating pool; 4 shown) ───────────────────────────────────────────
const DAILY: MissionDef[] = [
  { id: "d_total_wins_2", period: "daily", title: "Win 2 matches", description: "Quick wins today (any mode).", rewardLabel: "250 XP", target: 2, progress: (c) => c.winsToday },
  { id: "d_total_wins_3", period: "daily", title: "Win 3 matches", description: "Three wins today (any mode).", rewardLabel: "250 XP", target: 3, progress: (c) => c.winsToday },
  { id: "d_total_matches_3", period: "daily", title: "Play 3 matches", description: "Complete 3 matches today.", rewardLabel: "250 XP", target: 3, progress: (c) => c.matchesToday },
  { id: "d_total_wins_5", period: "daily", title: "Win 5 matches", description: "Rack up 5 wins today.", rewardLabel: "250 XP", target: 5, progress: (c) => c.winsToday },
];

// ── Weekly (4 shown; 2 carry the 50-PC beta offer) ───────────────────────────
const WEEKLY: MissionDef[] = [
  { id: "w_total_wins_10", period: "weekly", title: "Win 10 matches", description: "Any wins count this week.", rewardLabel: "2500 XP", target: 10, betaProtoCredits: 50, progress: (c) => c.winsThisWeek },
  { id: "w_total_matches_25", period: "weekly", title: "Play 25 matches", description: "Complete 25 matches this week.", rewardLabel: "2500 XP", target: 25, progress: (c) => c.matchesThisWeek },
  { id: "w_total_wins_15", period: "weekly", title: "Win 15 matches", description: "Go hard — 15 wins this week.", rewardLabel: "2500 XP", target: 15, betaProtoCredits: 50, progress: (c) => c.winsThisWeek },
  { id: "w_total_matches_15", period: "weekly", title: "Play 15 matches", description: "Complete 15 matches this week.", rewardLabel: "2500 XP", target: 15, progress: (c) => c.matchesThisWeek },
];

// ── Period helpers ────────────────────────────────────────────────────────────

function startOfTodayLocal(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeekLocal(): number {
  // Week starts Monday (matching the web).
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day);
  return d.getTime();
}

/** Local YYYY-MM-DD. */
function localDateKey(ts = Date.now()): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function periodKeyFor(period: MissionPeriod): string {
  if (period === "permanent") return "permanent";
  if (period === "daily") return localDateKey();
  return localDateKey(startOfWeekLocal()); // weekly keyed by Monday's date
}

/** Milliseconds until the period resets (daily=midnight, weekly=Monday). */
export function msUntilReset(period: MissionPeriod): number {
  if (period === "daily") return startOfTodayLocal() + 24 * 3600_000 - Date.now();
  if (period === "weekly") return startOfWeekLocal() + 7 * 24 * 3600_000 - Date.now();
  return 0;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0h";
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Build the views ──────────────────────────────────────────────────────────

function buildCtx(user: User, career: CareerMatch[]): ProgressCtx {
  const dayStart = startOfTodayLocal();
  const weekStart = startOfWeekLocal();
  let winsToday = 0;
  let matchesToday = 0;
  let winsThisWeek = 0;
  let matchesThisWeek = 0;
  for (const m of career) {
    const t = m.played_at ? Date.parse(m.played_at) : NaN;
    if (Number.isNaN(t)) continue;
    const isWin = (m.result || "").toLowerCase() === "win";
    if (t >= weekStart) {
      matchesThisWeek += 1;
      if (isWin) winsThisWeek += 1;
    }
    if (t >= dayStart) {
      matchesToday += 1;
      if (isWin) winsToday += 1;
    }
  }
  return { user, winsToday, matchesToday, winsThisWeek, matchesThisWeek };
}

function toViews(defs: MissionDef[], ctx: ProgressCtx): MissionView[] {
  return defs.map((d) => {
    const value = d.progress(ctx);
    return { ...d, value, complete: value >= d.target };
  });
}

export interface MissionBoard {
  daily: MissionView[];
  weekly: MissionView[];
  permanent: MissionView[];
}

export function buildMissions(user: User, career: CareerMatch[]): MissionBoard {
  const ctx = buildCtx(user, career);
  return {
    daily: toViews(DAILY, ctx),
    weekly: toViews(WEEKLY, ctx),
    permanent: toViews(PERMANENT, ctx),
  };
}

/** Back-compat: permanent-only view from the profile alone. */
export function missionsForUser(user: User): MissionView[] {
  return toViews(PERMANENT, { user, winsToday: 0, matchesToday: 0, winsThisWeek: 0, matchesThisWeek: 0 });
}

// ── Claim ─────────────────────────────────────────────────────────────────────

export interface ClaimResult {
  already_claimed: boolean;
  xp_awarded: number;
}

export async function claimMission(
  missionId: string,
  period: MissionPeriod = "permanent",
): Promise<ClaimResult> {
  try {
    const res = await API.post<{
      already_claimed: boolean;
      xp_awarded: number;
      profile: User | null;
    }>("/api/profile/claim-mission", {
      period,
      periodKey: periodKeyFor(period),
      missionId,
    });
    if (res.data.profile) useAuthStore.getState().setProfile(res.data.profile);
    return { already_claimed: res.data.already_claimed, xp_awarded: res.data.xp_awarded };
  } catch (err) {
    if (isAxiosError(err)) {
      const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
      throw new ApiError(typeof detail === "string" ? detail : "Could not claim mission.", err.response?.status);
    }
    throw new ApiError("Could not claim mission.");
  }
}
