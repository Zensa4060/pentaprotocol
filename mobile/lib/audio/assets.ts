/**
 * Bundled audio assets — Metro requires static paths with no spaces.
 * Pixel/space packs use renamed files under assets/sounds/.
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
  hover: require("../../assets/sounds/sfx_hover.wav"),
  click: require("../../assets/sounds/sfx_click.wav"),
  place: require("../../assets/sounds/sfx_place.wav"),
  transition: require("../../assets/sounds/sfx_transition.wav"),
  matchFound: require("../../assets/sounds/sfx_match_found.wav"),
  rulebreaker: require("../../assets/sounds/sfx_rulebreaker.wav"),
  victory: require("../../assets/sounds/sfx_victory.wav"),
  defeat: require("../../assets/sounds/sfx_defeat.wav"),
};

const PIXEL: Record<SfxKey, number> = {
  hover: require("../../assets/sounds/pixel_hover.wav"),
  click: require("../../assets/sounds/pixel_click.wav"),
  place: require("../../assets/sounds/pixel_place.wav"),
  transition: require("../../assets/sounds/pixel_transition.wav"),
  matchFound: require("../../assets/sounds/pixel_match_found.wav"),
  rulebreaker: require("../../assets/sounds/pixel_rulebreaker.wav"),
  victory: require("../../assets/sounds/pixel_win.wav"),
  defeat: require("../../assets/sounds/pixel_defeat.wav"),
};

const SPACE: Record<SfxKey, number> = {
  hover: require("../../assets/sounds/space_hover.wav"),
  click: require("../../assets/sounds/space_click.wav"),
  place: require("../../assets/sounds/space_place.wav"),
  transition: require("../../assets/sounds/space_transition.wav"),
  matchFound: require("../../assets/sounds/space_match_found.wav"),
  rulebreaker: require("../../assets/sounds/space_rulebreaker.wav"),
  victory: require("../../assets/sounds/space_win.wav"),
  defeat: require("../../assets/sounds/space_defeat.wav"),
};

export const SFX_BY_PACK: Record<SfxPack, Record<SfxKey, number>> = {
  classic: CLASSIC,
  pixel: PIXEL,
  space: SPACE,
};

export const AUTH_BGM = require("../../assets/bgm/auth.mp3");

/** Map profile theme id → SFX pack (same rules as web ``resolveSfxPack``). */
export function resolveSfxPack(themeId: string | null | undefined): SfxPack {
  if (themeId === "pixel") return "pixel";
  if (themeId === "space") return "space";
  return "classic";
}
