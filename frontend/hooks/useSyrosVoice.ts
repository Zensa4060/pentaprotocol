"use client";

/**
 * Syros voice — built-in browser text-to-speech (Web Speech API).
 *
 * The guided onboarding and the Syros boss narrate lines on-screen; this
 * hook speaks them aloud with a cold, low cadence so it reads as Syros
 * rather than a chirpy assistant. No audio assets — everything is the
 * platform `speechSynthesis` engine, so it works offline and ships nothing.
 *
 * Mute: respects the shared `pp_muted` flag (same key `useAudio` writes) AND
 * a dedicated `pp_syros_voice` toggle, so a player can silence narration
 * without muting music. Both are read live at `speak()` time.
 *
 * SSR-safe: every `window`/`speechSynthesis` access is guarded so this can
 * be imported into Next.js client components without blowing up during the
 * server render.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const VOICE_PREF_KEY = "pp_syros_voice";
const MUTED_KEY = "pp_muted";

/** Cold, deliberate delivery — Syros is ancient, not excitable. */
const SYROS_PITCH = 0.7;
const SYROS_RATE = 0.92;

function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTED_KEY) === "true";
}

function readVoiceEnabled(): boolean {
  if (typeof window === "undefined") return true;
  // Default ON for first-run users (the whole point is a narrated tutorial).
  return window.localStorage.getItem(VOICE_PREF_KEY) !== "0";
}

/**
 * Pick the most "Syros" voice available: prefer a deep English male voice,
 * fall back to any English voice, then the platform default. Voices load
 * asynchronously on most browsers, so callers re-resolve lazily.
 */
function pickSyrosVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  const preferred = [
    "Google UK English Male",
    "Microsoft Guy",
    "Microsoft David",
    "Daniel",
    "Arthur",
    "Rishi",
  ];
  for (const name of preferred) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
    if (hit) return hit;
  }
  const male = pool.find((v) => /male|david|guy|daniel|arthur|fred/i.test(v.name));
  return male ?? pool[0] ?? null;
}

export interface SyrosVoice {
  /** True iff the browser can do TTS at all. */
  supported: boolean;
  /** User-facing on/off for narration (persisted, independent of music mute). */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  /** Speak a line. No-ops when muted/disabled/unsupported. Cancels any line in progress. */
  speak: (text: string, opts?: { onEnd?: () => void }) => void;
  /** Stop whatever is being spoken right now. */
  cancel: () => void;
}

export function useSyrosVoice(): SyrosVoice {
  const supported = ttsSupported();
  const [enabled, setEnabledState] = useState<boolean>(() => readVoiceEnabled());
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Resolve (and keep refreshing) the chosen voice as the engine loads them.
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const refresh = () => {
      voiceRef.current = pickSyrosVoice(synth.getVoices());
    };
    refresh();
    synth.addEventListener?.("voiceschanged", refresh);
    return () => {
      synth.removeEventListener?.("voiceschanged", refresh);
      // Don't leave Syros talking after the component unmounts.
      try {
        synth.cancel();
      } catch {
        /* noop */
      }
    };
  }, [supported]);

  const setEnabled = useCallback(
    (on: boolean) => {
      setEnabledState(on);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(VOICE_PREF_KEY, on ? "1" : "0");
      }
      if (!on && supported) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
      }
    },
    [supported],
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
  }, [supported]);

  const speak = useCallback(
    (text: string, opts?: { onEnd?: () => void }) => {
      const line = text?.trim();
      if (!supported || !line || isMuted() || !readVoiceEnabled()) {
        // Still fire onEnd so callers that chain on narration don't stall
        // when the voice is off / unsupported.
        opts?.onEnd?.();
        return;
      }
      const synth = window.speechSynthesis;
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(line);
        u.pitch = SYROS_PITCH;
        u.rate = SYROS_RATE;
        u.volume = 1;
        if (voiceRef.current) {
          u.voice = voiceRef.current;
          u.lang = voiceRef.current.lang;
        }
        if (opts?.onEnd) {
          u.onend = () => opts.onEnd?.();
          u.onerror = () => opts.onEnd?.();
        }
        synth.speak(u);
      } catch {
        opts?.onEnd?.();
      }
    },
    [supported],
  );

  return { supported, enabled, setEnabled, speak, cancel };
}
