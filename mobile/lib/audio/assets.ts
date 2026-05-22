/**
 * Bundled audio assets — mirrors web ``useAudio`` SFX packs.
 * BGM loop tracks (classic_lobby.mp3, etc.) are not in the repo yet;
 * only ``auth.mp3`` ships; game/lobby BGM is a no-op until those files exist.
 */

export type SfxKey =
  | "hover"
  | "click"
  | "place"
  | "transition"
  | "matchFound"
  | "rulebreaker"
  | "victory"
  | "defeat";

export type SfxPack = "classic" | "pixel" | "space";

const CLASSIC: Record<SfxKey, number> = {
  hover: require("@/assets/sounds/sfx_hover.wav"),
  click: require("@/assets/sounds/sfx_click.wav"),
  place: require("@/assets/sounds/sfx_place.wav"),
  transition: require("@/assets/sounds/sfx_transition.wav"),
  matchFound: require("@/assets/sounds/sfx_match_found.wav"),
  rulebreaker: require("@/assets/sounds/sfx_rulebreaker.wav"),
  victory: require("@/assets/sounds/sfx_victory.wav"),
  defeat: require("@/assets/sounds/sfx_defeat.wav"),
};

const PIXEL: Record<SfxKey, number> = {
  hover: require("@/assets/sounds/Pixel Hover.wav"),
  click: require("@/assets/sounds/Pixel Click.wav"),
  place: require("@/assets/sounds/Pixel Place.wav"),
  transition: require("@/assets/sounds/Pixel UI Transition.wav"),
  matchFound: require("@/assets/sounds/Pixel Match Found.wav"),
  rulebreaker: require("@/assets/sounds/Pixel Rulebreaker.wav"),
  victory: require("@/assets/sounds/Pixel Win.wav"),
  defeat: require("@/assets/sounds/Pixel Defeat.wav"),
};

const SPACE: Record<SfxKey, number> = {
  hover: require("@/assets/sounds/Space Hover.wav"),
  click: require("@/assets/sounds/Space Click.wav"),
  place: require("@/assets/sounds/Space Place.wav"),
  transition: require("@/assets/sounds/Space UI transition.wav"),
  matchFound: require("@/assets/sounds/Space match found.wav"),
  rulebreaker: require("@/assets/sounds/Space Rulebreaker.wav"),
  victory: require("@/assets/sounds/Space Win.wav"),
  defeat: require("@/assets/sounds/Space Defeat.wav"),
};

export const SFX_BY_PACK: Record<SfxPack, Record<SfxKey, number>> = {
  classic: CLASSIC,
  pixel: PIXEL,
  space: SPACE,
};

export const AUTH_BGM = require("@/assets/bgm/auth.mp3");

/** Map profile theme id → SFX pack (same rules as web ``resolveSfxPack``). */
export function resolveSfxPack(themeId: string | null | undefined): SfxPack {
  if (themeId === "pixel") return "pixel";
  if (themeId === "space") return "space";
  return "classic";
}
