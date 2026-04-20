"use client";

import { useEffect, useState } from "react";

export const BANNER_SHINE_CHANGED_EVENT = "pp:banner-shine-changed";

const LEGACY_GLOBAL_KEY = "pp_banner_shine_enabled";

function storageKeyForCurrentUser(): string {
  if (typeof window === "undefined") return LEGACY_GLOBAL_KEY;
  try {
    const raw = localStorage.getItem("pp_user");
    if (!raw) return LEGACY_GLOBAL_KEY;
    const u = JSON.parse(raw);
    const id = u?.id ?? u?._id;
    if (id == null || id === "") return LEGACY_GLOBAL_KEY;
    return `pp_banner_shine_enabled:${id}`;
  } catch {
    return LEGACY_GLOBAL_KEY;
  }
}

/** When true (default), the diagonal banner shine overlay is shown wherever banners appear. */
export function loadBannerShineEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const key = storageKeyForCurrentUser();
    let raw = localStorage.getItem(key);
    if (raw === null && key !== LEGACY_GLOBAL_KEY) {
      const legacy = localStorage.getItem(LEGACY_GLOBAL_KEY);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (raw === null) return true;
    return raw !== "false";
  } catch {
    return true;
  }
}

export function saveBannerShineEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    const key = storageKeyForCurrentUser();
    localStorage.setItem(key, enabled ? "true" : "false");
    window.dispatchEvent(new Event(BANNER_SHINE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function useBannerShineEnabled(accountRevision?: string | number | null): boolean {
  const [v, setV] = useState(true);

  useEffect(() => {
    setV(loadBannerShineEnabled());
  }, [accountRevision]);

  useEffect(() => {
    const sync = () => setV(loadBannerShineEnabled());
    window.addEventListener("storage", sync);
    window.addEventListener(BANNER_SHINE_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(BANNER_SHINE_CHANGED_EVENT, sync);
    };
  }, []);

  return v;
}
