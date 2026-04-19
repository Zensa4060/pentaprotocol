import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/**
 * True only for a real Supabase project URL. Rejects empty strings, typos,
 * and the old placeholder host — those produce net::ERR_NAME_NOT_RESOLVED
 * ("Failed to fetch") in the browser.
 */
export function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!host.endsWith(".supabase.co")) return false;
    if (host === "placeholder.supabase.co") return false;
    const sub = host.slice(0, -".supabase.co".length);
    return sub.length >= 8 && /^[a-z0-9-]+$/.test(sub);
  } catch {
    return false;
  }
}

export const isSupabaseConfigured =
  isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey.length >= 20;

let client: SupabaseClient | null = null;

/** Browser-side uploads should use this; returns null when env is missing or invalid. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

/** Map generic fetch/DNS failures to something actionable in the UI. */
export function formatSupabaseUploadError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("load failed") ||
    lower.includes("networkerror") ||
    lower.includes("name_not_resolved") ||
    lower.includes("err_name_not_resolved")
  ) {
    return (
      "Cannot reach your Supabase project (network/DNS). " +
      "Copy Project URL exactly from Supabase → Settings → API into NEXT_PUBLIC_SUPABASE_URL " +
      "(format https://<ref>.supabase.co, no trailing path), redeploy the frontend, and try again."
    );
  }
  return raw;
}
