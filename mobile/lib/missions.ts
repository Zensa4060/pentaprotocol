/**
 * Missions — a focused set of **permanent** milestone missions whose
 * ids match the backend (``perm_*`` are all valid in
 * ``backend/app/core/mission_xp.py``). Progress is derived from the
 * authoritative profile; claiming hits ``POST /api/profile/claim-mission``
 * which awards XP and returns the fresh profile.
 *
 * Daily / weekly missions are intentionally out of scope on mobile —
 * they require period-key bookkeeping that lives in the web client.
 */

import API from "@/lib/api";
import { ApiError } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { isAxiosError } from "axios";

export interface MissionDef {
  id: string;
  label: string;
  description: string;
  /** Target value to complete the mission. */
  target: number;
  /** Current progress for a given user. */
  current: (u: User) => number;
}

export interface MissionView extends MissionDef {
  value: number;
  complete: boolean;
}

const DEFS: MissionDef[] = [
  { id: "perm_total_wins_10", label: "First Strides", description: "Win 10 games.", target: 10, current: (u) => u.wins },
  { id: "perm_total_wins_50", label: "Seasoned", description: "Win 50 games.", target: 50, current: (u) => u.wins },
  { id: "perm_total_wins_100", label: "Centurion", description: "Win 100 games.", target: 100, current: (u) => u.wins },
  { id: "perm_level_5", label: "Level 5", description: "Reach account level 5 (unlocks ranked).", target: 5, current: (u) => u.level },
  { id: "perm_level_10", label: "Level 10", description: "Reach account level 10.", target: 10, current: (u) => u.level },
  { id: "perm_level_25", label: "Level 25", description: "Reach account level 25.", target: 25, current: (u) => u.level },
  { id: "perm_rank_advanced", label: "Skilled", description: "Reach SKILLED (1500 ELO).", target: 1500, current: (u) => u.elo ?? 0 },
  { id: "perm_rank_master", label: "Cracked", description: "Reach CRACKED (2000 ELO).", target: 2000, current: (u) => u.elo ?? 0 },
  { id: "perm_rank_legend", label: "Chronicle", description: "Reach CHRONICLE (2500 ELO) — huge reward.", target: 2500, current: (u) => u.elo ?? 0 },
];

export function missionsForUser(u: User): MissionView[] {
  return DEFS.map((d) => {
    const value = d.current(u);
    return { ...d, value, complete: value >= d.target };
  });
}

export interface ClaimResult {
  already_claimed: boolean;
  xp_awarded: number;
}

export async function claimMission(missionId: string): Promise<ClaimResult> {
  try {
    const res = await API.post<{
      already_claimed: boolean;
      xp_awarded: number;
      profile: User | null;
    }>("/api/profile/claim-mission", {
      period: "permanent",
      periodKey: "permanent",
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
