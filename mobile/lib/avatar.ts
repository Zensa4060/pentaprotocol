/**
 * Local (on-device) avatar store.
 *
 * The backend only persists avatars as **https URLs** and offers no
 * upload endpoint (see ``backend/app/routers/profile.py``), so a photo
 * picked from the device cannot be stored server-side without a backend
 * change. To still honour "device photo upload" we persist the picked
 * image on this device and resolve it ahead of ``user.avatar`` wherever
 * an avatar is shown. Setting an avatar by **URL** still persists
 * server-side (and syncs across devices).
 */

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pp_avatar_uri";

type Listener = (uri: string | null) => void;
const listeners = new Set<Listener>();
let current: string | null = null;
let loaded = false;

function emit() {
  for (const l of listeners) l(current);
}

/** Load the persisted local avatar once into the in-memory cache. */
export async function initLocalAvatar(): Promise<string | null> {
  try {
    current = (await AsyncStorage.getItem(KEY)) ?? null;
  } catch {
    current = null;
  }
  loaded = true;
  emit();
  return current;
}

export async function setLocalAvatar(uri: string | null): Promise<void> {
  current = uri;
  loaded = true;
  try {
    if (uri) await AsyncStorage.setItem(KEY, uri);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    /* best effort — the in-memory value still applies this session */
  }
  emit();
}

export function getLocalAvatar(): string | null {
  return current;
}

/**
 * Subscribe to the local avatar. Returns the device-local avatar uri
 * (or null). Screens use ``localAvatar ?? user.avatar`` so a picked
 * photo shows everywhere immediately.
 */
export function useLocalAvatar(): string | null {
  const [uri, setUri] = useState<string | null>(current);
  useEffect(() => {
    const l: Listener = (u) => setUri(u);
    listeners.add(l);
    if (!loaded) void initLocalAvatar();
    else setUri(current);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return uri;
}
