/**
 * Coin-toss skin preference — device-local, mirroring the web where the
 * equipped toss skin lives in the ``customTheme`` localStorage blob
 * (``tossSkin``). Ownership is server-side (``purchased_items`` /
 * bot-reward claims); which owned skin is *active* is a client choice.
 *
 * Mobile renders the standard PENTA/PROTO coin flip for every skin but
 * tints the spin/reveal glow with the skin's signature colour — the full
 * canvas animations (Wraith King et al.) stay web-only for now.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "pp_toss_skin";

export type TossSkinId =
  | "default"
  | "wraith_king";

export const TOSS_SKIN_IDS: TossSkinId[] = [
  "default",
  "wraith_king",
];

/** Store catalog id → toss skin id (``coin_bundle_wraith_king`` → ``wraith_king``). */
export function tossSkinFromStoreId(storeId: string): TossSkinId | null {
  const stripped = storeId.replace(/^coin_bundle_/, "");
  return (TOSS_SKIN_IDS as string[]).includes(stripped) ? (stripped as TossSkinId) : null;
}

/** Signature glow colour per skin (mirror web coin-toss accents). */
export const TOSS_SKIN_GLOW: Record<TossSkinId, string | null> = {
  default: null, // falls back to the winning face's PENTA/PROTO colour
  wraith_king: "#CC88FF",
};

export async function loadTossSkin(): Promise<TossSkinId> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v && (TOSS_SKIN_IDS as string[]).includes(v) ? (v as TossSkinId) : "default";
  } catch {
    return "default";
  }
}

export async function saveTossSkin(id: TossSkinId): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    /* preference only — never block on storage errors */
  }
}

/** Read + update the equipped toss skin (loads async on mount). */
export function useTossSkin(): [TossSkinId, (id: TossSkinId) => Promise<void>] {
  const [skin, setSkin] = useState<TossSkinId>("default");

  useEffect(() => {
    let alive = true;
    loadTossSkin().then((v) => {
      if (alive) setSkin(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback(async (id: TossSkinId) => {
    setSkin(id);
    await saveTossSkin(id);
  }, []);

  return [skin, update];
}
