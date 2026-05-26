/**
 * BGM file names + remote URLs (same files as web ``/sounds/*.mp3``).
 */

import { AUTH_BGM } from "./assets";

export type BgmContext = "lobby" | "game" | "ranked";
export type BgmPack = "classic" | "space" | "pixel";

const BGM_FILES: Record<BgmPack, Record<BgmContext, string>> = {
  classic: {
    lobby: "classic_lobby.mp3",
    game: "classic_game.mp3",
    ranked: "classic_ranked.mp3",
  },
  space: {
    lobby: "space_lobby.mp3",
    game: "space_game.mp3",
    ranked: "space_ranked.mp3",
  },
  pixel: {
    lobby: "pixel_lobby.mp3",
    game: "pixel_game.mp3",
    ranked: "pixel_ranked.mp3",
  },
};

const SOUNDS_CDN = "https://www.pentaprotocol.com/sounds";

export function resolveBgmPack(themeId: string | null | undefined): BgmPack {
  if (themeId === "pixel") return "pixel";
  if (themeId === "space") return "space";
  return "classic";
}

export function bgmRemoteUri(pack: BgmPack, context: BgmContext): { uri: string } {
  const file = BGM_FILES[pack][context];
  return { uri: `${SOUNDS_CDN}/${file}` };
}

/** Bundled fallback when CDN unreachable. */
export const BGM_FALLBACK = AUTH_BGM;
