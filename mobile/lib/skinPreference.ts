/**
 * On-device persistence for the equipped board + piece skin.
 *
 * Mirrors ``lib/themePreference`` — the equipped skin is a client
 * cosmetic preference (no backend field), so it lives in AsyncStorage
 * and survives restarts. Ownership is still gated server-side via
 * ``purchased_items``; this only remembers *which* owned skin is active.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_BOARD_SKIN, DEFAULT_PIECE_SKIN } from "@/lib/cosmetics/skins";

const BOARD_KEY = "pp_board_skin";
const PIECE_KEY = "pp_piece_skin";

export interface SkinPreference {
  boardSkinId: string;
  pieceSkinId: string;
}

export async function loadSkinPreference(): Promise<SkinPreference> {
  const [board, piece] = await Promise.all([
    AsyncStorage.getItem(BOARD_KEY),
    AsyncStorage.getItem(PIECE_KEY),
  ]);
  return {
    boardSkinId: board ?? DEFAULT_BOARD_SKIN,
    pieceSkinId: piece ?? DEFAULT_PIECE_SKIN,
  };
}

export async function saveSkinPreference(pref: SkinPreference): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(BOARD_KEY, pref.boardSkinId),
    AsyncStorage.setItem(PIECE_KEY, pref.pieceSkinId),
  ]);
}
