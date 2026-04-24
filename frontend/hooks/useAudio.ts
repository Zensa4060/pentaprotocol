import { useEffect, useRef, useState, useCallback } from "react";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import authBgmBundled from "../assets/bgm/auth.mp3";

/** Logical id for auth BGM (internal); actual URL is webpack-emitted from `assets/bgm`. */
export const AUTH_BGM_FILE = "auth.mp3";

const BGM_MAP: Record<string, Record<string, string>> = {
  classic_light: { lobby: "classic_lobby.mp3", game: "classic_game.mp3", ranked: "classic_ranked.mp3" },
  classic_dark: { lobby: "classic_lobby.mp3", game: "classic_game.mp3", ranked: "classic_ranked.mp3" },
  classic: { lobby: "classic_lobby.mp3", game: "classic_game.mp3", ranked: "classic_ranked.mp3" },
  space: { lobby: "space_lobby.mp3", game: "space_game.mp3", ranked: "space_ranked.mp3" },
  pixel: { lobby: "pixel_lobby.mp3", game: "pixel_game.mp3", ranked: "pixel_ranked.mp3" },
};

const SFX_MAP: Record<string, Record<string, string>> = {
  default: {
    hover: "sfx_hover.wav",
    click: "sfx_click.wav",
    place: "sfx_place.wav",
    transition: "sfx_transition.wav",
    matchFound: "sfx_match_found.wav",
    rulebreaker: "sfx_rulebreaker.wav",
    victory: "sfx_victory.wav",
    defeat: "sfx_defeat.wav",
  },
  classic: {
    hover: "sfx_hover.wav",
    click: "sfx_click.wav",
    place: "sfx_place.wav",
    transition: "sfx_transition.wav",
    matchFound: "sfx_match_found.wav",
    rulebreaker: "sfx_rulebreaker.wav",
    victory: "sfx_victory.wav",
    defeat: "sfx_defeat.wav",
  },
  space: {
    hover: "Space Hover.wav",
    click: "Space Click.wav",
    place: "Space Place.wav",
    transition: "Space UI transition.wav",
    matchFound: "Space match found.wav",
    rulebreaker: "Space Rulebreaker.wav",
    victory: "Space Win.wav",
    defeat: "Space Defeat.wav",
  },
  pixel: {
    hover: "Pixel Hover.wav",
    click: "Pixel Click.wav",
    place: "Pixel Place.wav",
    transition: "Pixel UI Transition.wav",
    matchFound: "Pixel Match Found.wav",
    rulebreaker: "Pixel Rulebreaker.wav",
    victory: "Pixel Win.wav",
    defeat: "Pixel Defeat.wav",
  },
};

// Resolve which SFX pack to use for a given themeId
function resolveSfxPack(themeId: string): string {
  if (themeId === "custom") {
    const t = THEMES["custom" as ThemeId] as any;
    return t?._sfxPack ?? "classic";
  }
  if (SFX_MAP[themeId]) return themeId;
  return "default";
}

// Resolve which BGM pack to use for a given themeId
function resolveBgmPack(themeId: string): string {
  if (themeId === "custom") {
    const t = THEMES["custom" as ThemeId] as any;
    return t?._musicPack ?? "classic";
  }
  return themeId;
}

function getSfxFile(themeId: string, key: string): string {
  const pack = resolveSfxPack(themeId);
  return SFX_MAP[pack]?.[key] ?? SFX_MAP.default[key];
}

export function useAudio() {
  const [musicVol, setMusicVol] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pp_music_vol");
      return saved !== null ? parseFloat(saved) : 0.5;
    }
    return 0.5;
  });
  const [sfxVol, setSfxVol] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pp_sfx_vol");
      return saved !== null ? parseFloat(saved) : 0.6;
    }
    return 0.6;
  });
  const [muted, setMuted] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pp_muted") === "true";
    }
    return false;
  });
  const [theme, setTheme] = useState("classic_dark");

  const mutedRef = useRef(false);
  const sfxVolRef = useRef(0.6);
  const musicVolRef = useRef(0.5);
  const themeRef = useRef("classic_dark");
  const currentSrc = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSrc = useRef<string>("");

  mutedRef.current = muted;
  musicVolRef.current = musicVol;
  sfxVolRef.current = sfxVol;
  themeRef.current = theme;

  const clearFade = () => {
    if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; }
  };

  const hardStop = () => {
    clearFade();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    currentSrc.current = "";
    pendingSrc.current = "";
  };

  const switchTo = useCallback((src: string) => {
    if (!src) return;
    if (currentSrc.current === src && audioRef.current && !audioRef.current.paused) return;

    if (fadeTimer.current) {
      pendingSrc.current = src;
      return;
    }

    const STEPS = 8;
    const INTERVAL = 20;

    const old = audioRef.current;
    const downStep = old ? old.volume / STEPS : 0;

    const url = src === AUTH_BGM_FILE ? authBgmBundled : `/sounds/${src}`;
    const next = new Audio(url);
    next.loop = true;
    next.volume = 0;
    next.play().catch(err => {
      if (err.name !== "AbortError") console.warn("Audio play failed:", err);
    });

    audioRef.current = next;
    currentSrc.current = src;

    const target = mutedRef.current ? 0 : musicVolRef.current;
    const upStep = target / STEPS;
    let step = 0;

    fadeTimer.current = setInterval(() => {
      step++;
      if (audioRef.current === next) next.volume = Math.min(target, step * upStep);
      if (old) {
        const nv = old.volume - downStep;
        if (nv <= 0.001) { old.pause(); old.src = ""; }
        else old.volume = nv;
      }
      if (step >= STEPS) {
        clearFade();
        if (pendingSrc.current && pendingSrc.current !== currentSrc.current) {
          const next2 = pendingSrc.current;
          pendingSrc.current = "";
          switchTo(next2);
        }
      }
    }, INTERVAL);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : musicVol;
    if (typeof window !== "undefined") {
      localStorage.setItem("pp_music_vol", musicVol.toString());
      localStorage.setItem("pp_muted", muted.toString());
    }
  }, [musicVol, muted]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pp_sfx_vol", sfxVol.toString());
    }
  }, [sfxVol]);

  const playBgm = useCallback((themeId: string, context: "lobby" | "game" | "ranked") => {
    setTheme(themeId);
    const pack = resolveBgmPack(themeId);
    const src = BGM_MAP[pack]?.[context];
    if (src) switchTo(src);
  }, [switchTo]);

  /** Auth page + policy acceptance gate: always `auth.mp3`; SFX pack still follows `themeId`. */
  const playAuthBgm = useCallback(
    (themeId: string) => {
      setTheme(themeId);
      switchTo(AUTH_BGM_FILE);
    },
    [switchTo],
  );

  const playSfx = useCallback((src: string) => {
    if (mutedRef.current) return;
    const a = new Audio(`/sounds/${src}`);
    a.volume = sfxVolRef.current;
    a.play().catch(() => { });
  }, []);

  // Named SFX helpers — resolve pack at call-time so custom theme changes take effect immediately
  const sfx = {
    hover: () => playSfx(getSfxFile(themeRef.current, "hover")),
    click: () => playSfx(getSfxFile(themeRef.current, "click")),
    place: () => playSfx(getSfxFile(themeRef.current, "place")),
    transition: () => playSfx(getSfxFile(themeRef.current, "transition")),
    matchFound: () => playSfx(getSfxFile(themeRef.current, "matchFound")),
    rulebreaker: () => playSfx(getSfxFile(themeRef.current, "rulebreaker")),
    victory: () => playSfx(getSfxFile(themeRef.current, "victory")),
    defeat: () => playSfx(getSfxFile(themeRef.current, "defeat")),
  };

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m;
      mutedRef.current = next;
      if (audioRef.current) audioRef.current.volume = next ? 0 : musicVolRef.current;
      return next;
    });
  }, []);

  const pauseBgm = useCallback(() => {
    clearFade();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, []);

  const resumeBgm = useCallback(() => {
    clearFade();
    if (!audioRef.current || !currentSrc.current) return;
    audioRef.current.volume = mutedRef.current ? 0 : musicVolRef.current;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => { });
    }
  }, []);

  useEffect(() => () => hardStop(), []);

  return { musicVol, setMusicVol, sfxVol, setSfxVol, muted, toggleMute, playSfx, playBgm, playAuthBgm, pauseBgm, resumeBgm, sfx };
}