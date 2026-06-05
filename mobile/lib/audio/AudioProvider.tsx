/**
 * Mobile audio — classic / pixel / space SFX + auth BGM.
 * Volume + mute persist via AsyncStorage (same keys as web localStorage).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, type AVPlaybackSource } from "expo-av";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  bgmRemoteUri,
  BGM_FALLBACK,
  resolveBgmPack,
  type BgmContext,
  type BgmPack,
} from "./bgm";
import { AUTH_BGM, resolveSfxPack, SFX_BY_PACK, type SfxKey, type SfxPack } from "./assets";

const STORAGE_MUSIC = "pp_music_vol";
const STORAGE_SFX = "pp_sfx_vol";
const STORAGE_MUTED = "pp_muted";

export type { BgmContext } from "./bgm";

export interface GameAudioContextValue {
  musicVol: number;
  setMusicVol: (v: number) => void;
  sfxVol: number;
  setSfxVol: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  sfxPack: SfxPack;
  setSfxPack: (pack: SfxPack) => void;
  bgmPack: BgmPack;
  setBgmPack: (pack: BgmPack) => void;
  playAuthBgm: () => void;
  playBgm: (context: BgmContext) => void;
  pauseBgm: () => void;
  resumeBgm: () => void;
  sfx: {
    hover: () => void;
    click: () => void;
    place: () => void;
    transition: () => void;
    matchFound: () => void;
    rulebreaker: () => void;
    victory: () => void;
    defeat: () => void;
  };
}

const GameAudioContext = createContext<GameAudioContextValue | null>(null);

export function useGameAudio(): GameAudioContextValue {
  const ctx = useContext(GameAudioContext);
  if (!ctx) throw new Error("useGameAudio must be used within AudioProvider");
  return ctx;
}

/** Safe when audio provider is not mounted (e.g. tests). */
export function useGameAudioOptional(): GameAudioContextValue | null {
  return useContext(GameAudioContext);
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [musicVol, setMusicVolState] = useState(0.5);
  const [sfxVol, setSfxVolState] = useState(0.6);
  const [muted, setMuted] = useState(false);
  const [sfxPack, setSfxPackState] = useState<SfxPack>("classic");
  const [bgmPack, setBgmPackState] = useState<BgmPack>("classic");

  const mutedRef = useRef(false);
  const musicVolRef = useRef(0.5);
  const sfxVolRef = useRef(0.6);
  const sfxPackRef = useRef<SfxPack>("classic");
  const bgmPackRef = useRef<BgmPack>("classic");
  const bgmContextRef = useRef<BgmContext>("lobby");
  const bgmRef = useRef<Audio.Sound | null>(null);
  // Monotonic token: every switchBgm call claims the next value. A call
  // whose token is no longer the latest discards whatever it created, so
  // overlapping switches (screen A unmount + screen B mount, or
  // setBgmPack + playBgm firing together) can never leave an orphaned
  // looping sound playing underneath the current one (the "echo" bug).
  const bgmSeqRef = useRef(0);
  const readyRef = useRef(false);

  mutedRef.current = muted;
  musicVolRef.current = musicVol;
  sfxVolRef.current = sfxVol;
  sfxPackRef.current = sfxPack;
  bgmPackRef.current = bgmPack;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const [m, s, mu] = await Promise.all([
          AsyncStorage.getItem(STORAGE_MUSIC),
          AsyncStorage.getItem(STORAGE_SFX),
          AsyncStorage.getItem(STORAGE_MUTED),
        ]);
        if (cancelled) return;
        if (m !== null) setMusicVolState(parseFloat(m));
        if (s !== null) setSfxVolState(parseFloat(s));
        if (mu !== null) setMuted(mu === "true");
        readyRef.current = true;
      } catch {
        readyRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
      bgmRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  const setMusicVol = useCallback((v: number) => {
    setMusicVolState(v);
    musicVolRef.current = v;
    AsyncStorage.setItem(STORAGE_MUSIC, String(v)).catch(() => undefined);
    if (bgmRef.current && !mutedRef.current) {
      bgmRef.current.setVolumeAsync(v).catch(() => undefined);
    }
  }, []);

  const setSfxVol = useCallback((v: number) => {
    setSfxVolState(v);
    sfxVolRef.current = v;
    AsyncStorage.setItem(STORAGE_SFX, String(v)).catch(() => undefined);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      AsyncStorage.setItem(STORAGE_MUTED, String(next)).catch(() => undefined);
      if (bgmRef.current) {
        bgmRef.current.setVolumeAsync(next ? 0 : musicVolRef.current).catch(() => undefined);
      }
      return next;
    });
  }, []);

  const setSfxPack = useCallback((pack: SfxPack) => {
    sfxPackRef.current = pack;
    setSfxPackState(pack);
  }, []);

  const playOneShot = useCallback(async (key: SfxKey) => {
    if (!readyRef.current || mutedRef.current) return;
    try {
      const src = SFX_BY_PACK[sfxPackRef.current][key] as AVPlaybackSource;
      const { sound } = await Audio.Sound.createAsync(src, {
        volume: sfxVolRef.current,
        shouldPlay: true,
      });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => undefined);
        }
      });
    } catch {
      /* ignore — device mute / focus loss */
    }
  }, []);

  const switchBgm = useCallback(async (source: AVPlaybackSource) => {
    if (!readyRef.current) return;
    const seq = ++bgmSeqRef.current;
    // Tear down whatever is currently playing first.
    const existing = bgmRef.current;
    bgmRef.current = null;
    if (existing) {
      await existing.stopAsync().catch(() => undefined);
      await existing.unloadAsync().catch(() => undefined);
    }
    // A newer switch claimed the token while we were tearing down — bail
    // so we don't start a track the caller has already moved past.
    if (seq !== bgmSeqRef.current) return;
    try {
      const { sound } = await Audio.Sound.createAsync(source, {
        isLooping: true,
        volume: mutedRef.current ? 0 : musicVolRef.current,
        shouldPlay: true,
      });
      // Superseded during the async load: discard the sound we just made
      // so it can't keep looping as an untracked orphan (the echo).
      if (seq !== bgmSeqRef.current) {
        await sound.unloadAsync().catch(() => undefined);
        return;
      }
      bgmRef.current = sound;
    } catch {
      if (seq === bgmSeqRef.current && source !== BGM_FALLBACK && source !== AUTH_BGM) {
        switchBgm(BGM_FALLBACK).catch(() => undefined);
      }
    }
  }, []);

  const playAuthBgm = useCallback(() => {
    switchBgm(AUTH_BGM);
  }, [switchBgm]);

  const setBgmPack = useCallback((pack: BgmPack) => {
    bgmPackRef.current = pack;
    setBgmPackState(pack);
    switchBgm(bgmRemoteUri(pack, bgmContextRef.current)).catch(() => undefined);
  }, [switchBgm]);

  const playBgm = useCallback(
    (context: BgmContext) => {
      bgmContextRef.current = context;
      switchBgm(bgmRemoteUri(bgmPackRef.current, context));
    },
    [switchBgm],
  );

  const pauseBgm = useCallback(() => {
    bgmRef.current?.pauseAsync().catch(() => undefined);
  }, []);

  const resumeBgm = useCallback(() => {
    if (!bgmRef.current) return;
    bgmRef.current
      .setVolumeAsync(mutedRef.current ? 0 : musicVolRef.current)
      .then(() => bgmRef.current?.playAsync())
      .catch(() => undefined);
  }, []);

  const sfx = {
    hover: () => playOneShot("hover"),
    click: () => playOneShot("click"),
    place: () => playOneShot("place"),
    transition: () => playOneShot("transition"),
    matchFound: () => playOneShot("matchFound"),
    rulebreaker: () => playOneShot("rulebreaker"),
    victory: () => playOneShot("victory"),
    defeat: () => playOneShot("defeat"),
  };

  const value: GameAudioContextValue = {
    musicVol,
    setMusicVol,
    sfxVol,
    setSfxVol,
    muted,
    toggleMute,
    sfxPack,
    setSfxPack,
    bgmPack,
    setBgmPack,
    playAuthBgm,
    playBgm,
    pauseBgm,
    resumeBgm,
    sfx,
  };

  return (
    <GameAudioContext.Provider value={value}>{children}</GameAudioContext.Provider>
  );
}

/** Sync SFX pack from profile theme id (call from screens with profile data). */
export function useSyncAudioTheme(themeId: string | null | undefined) {
  const audio = useGameAudio();
  useEffect(() => {
    audio.setSfxPack(resolveSfxPack(themeId));
    audio.setBgmPack(resolveBgmPack(themeId));
  }, [themeId, audio]);
}
