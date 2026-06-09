/**
 * Career — ``GET /api/profile/career`` (recent matches) and
 * ``GET /api/profile/head-to-head/{opponentId}``.
 */

import API from "@/lib/api";
import { ApiError } from "@/lib/profile";
import type { CareerMatch, HeadToHead } from "@/lib/types";

export type CareerMatchDetail = CareerMatch;

export async function fetchCareer(): Promise<CareerMatch[]> {
  try {
    const res = await API.get<CareerMatch[]>("/api/profile/career");
    return res.data ?? [];
  } catch {
    throw new ApiError("Could not load your match history.");
  }
}

export async function fetchCareerMatch(entryId: string): Promise<CareerMatchDetail> {
  try {
    const res = await API.get<CareerMatchDetail>(
      `/api/profile/career-match/${encodeURIComponent(entryId)}`,
    );
    return res.data;
  } catch {
    throw new ApiError("Could not load this match.");
  }
}

export async function fetchHeadToHead(opponentId: string, mode?: string): Promise<HeadToHead> {
  try {
    const res = await API.get<HeadToHead>(`/api/profile/head-to-head/${opponentId}`, {
      params: mode ? { mode } : undefined,
    });
    return res.data;
  } catch {
    throw new ApiError("Could not load head-to-head.");
  }
}
