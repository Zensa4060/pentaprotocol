import type { ThemeId } from "@/lib/themes";
import type { BgSource } from "@/lib/customTheme";
import { loadCustomTheme } from "@/lib/customTheme";

/** Visual family for the match-found screen (mirrors app theme / custom background). */
export type MatchFoundSkin = "space" | "pixel" | "classic_2" | "classic_1";

export function resolveMatchFoundSkin(themeId: ThemeId): MatchFoundSkin {
  if (themeId === "space") return "space";
  if (themeId === "pixel") return "pixel";
  if (themeId === "classic_2") return "classic_2";
  if (themeId === "classic_1") return "classic_1";
  if (themeId === "custom") {
    const bg = loadCustomTheme().background as BgSource;
    if (bg === "space") return "space";
    if (bg === "pixel") return "pixel";
    if (bg === "classic_2") return "classic_2";
    return "classic_1";
  }
  return "classic_1";
}

export type MatchFoundPalette = {
  pageBg: string;
  pageBgOuter: string;
  gridLine: string;
  vsInk: string;
  vsDropShadow: string;
  sealBg: string;
  sealStroke: string;
  sealText: string;
  cardInk: string;
  cardInkSoft: string;
  rankedAccent: string;
  unrankedAccent: string;
  avatarInnerBg: string;
};

export function getMatchFoundPalette(skin: MatchFoundSkin): MatchFoundPalette {
  switch (skin) {
    case "classic_2":
      return {
        pageBg: "#EFE5CF",
        pageBgOuter: "#E4D6B7",
        gridLine: "rgba(60,40,20,0.18)",
        vsInk: "#0A0A0A",
        vsDropShadow: "rgba(0,0,0,0.28)",
        sealBg: "#0A0A0A",
        sealStroke: "rgba(242,237,228,0.38)",
        sealText: "#f2ede4",
        cardInk: "#0A0A0A",
        cardInkSoft: "#3A2E22",
        rankedAccent: "#B31919",
        unrankedAccent: "#0A0A0A",
        avatarInnerBg: "#1A1410",
      };
    case "classic_1":
      return {
        pageBg: "#161311",
        pageBgOuter: "#0B0908",
        gridLine: "rgba(255,235,200,0.07)",
        vsInk: "#F2EBE2",
        vsDropShadow: "rgba(255,220,200,0.32)",
        sealBg: "#2A2420",
        sealStroke: "rgba(255,248,235,0.35)",
        sealText: "#E8DED4",
        cardInk: "#F2EBE2",
        cardInkSoft: "rgba(242,235,228,0.55)",
        rankedAccent: "#FF4D4D",
        unrankedAccent: "#E8DED4",
        avatarInnerBg: "#0D0C0B",
      };
    case "space":
      return {
        pageBg: "#050B18",
        pageBgOuter: "#02040F",
        gridLine: "rgba(96,168,255,0.14)",
        vsInk: "#E8F6FF",
        vsDropShadow: "rgba(80,160,255,0.42)",
        sealBg: "#0A1A32",
        sealStroke: "rgba(120,200,255,0.45)",
        sealText: "#C8E8FF",
        cardInk: "#D8ECFF",
        cardInkSoft: "rgba(160,200,255,0.55)",
        rankedAccent: "#FF6B8A",
        unrankedAccent: "#FFD060",
        avatarInnerBg: "#030810",
      };
    case "pixel":
      return {
        pageBg: "#141c0f",
        pageBgOuter: "#0a1006",
        gridLine: "rgba(170,230,120,0.12)",
        vsInk: "#F5FF9A",
        vsDropShadow: "rgba(200,255,100,0.38)",
        sealBg: "#223018",
        sealStroke: "rgba(202,238,172,0.5)",
        sealText: "#CAEEAC",
        cardInk: "#E8FFD0",
        cardInkSoft: "rgba(190,230,150,0.55)",
        rankedAccent: "#FF5A8A",
        unrankedAccent: "#CAEEAC",
        avatarInnerBg: "#0d1209",
      };
    default:
      return getMatchFoundPalette("classic_1");
  }
}
