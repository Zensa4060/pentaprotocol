/**
 * SVG allowlist for `dangerouslySetInnerHTML` (Phase 2.4).
 *
 * A handful of screens (NavBar, MissionsScreen, ProfileScreen,
 * Storescreen) render inline SVG strings via React's
 * `dangerouslySetInnerHTML`. Today those strings are hard-coded
 * constants, which is safe — but if a future refactor accidentally
 * threads a user-controlled value into one of those blobs it becomes
 * a stored-XSS vector that the CSP cannot stop (we still ship
 * `unsafe-inline` on script-src until the Phase 3 nonce migration).
 *
 * This helper formalises "we only ever render SVGs from this list":
 *
 *   import { allowlistedSvg } from "@/lib/svgAllowlist";
 *
 *   <span dangerouslySetInnerHTML={{ __html: allowlistedSvg("rank_mythic") }} />
 *
 * If the id isn't registered, `allowlistedSvg` returns an empty string
 * in production (fail-closed) and throws in dev (so we catch drift in
 * code review, not at runtime).
 *
 * Registration is a one-liner per SVG — keep the strings in this file
 * or a sibling file that imports and registers them at module load.
 */

const _registry = new Map<string, string>();

const SVG_ID_PATTERN = /^[a-z0-9_.:-]+$/;

/**
 * Register a single SVG. Call at module load. Throws if the id is
 * already registered with different contents (to surface merge
 * conflicts).
 */
export function registerSvg(id: string, markup: string): void {
  if (!SVG_ID_PATTERN.test(id)) {
    throw new Error(`registerSvg: invalid id "${id}"`);
  }
  if (!markup.trim().startsWith("<svg")) {
    throw new Error(`registerSvg: "${id}" must start with <svg`);
  }
  const existing = _registry.get(id);
  if (existing !== undefined && existing !== markup) {
    throw new Error(`registerSvg: id "${id}" already registered with different markup`);
  }
  _registry.set(id, markup);
}

/** Bulk register — useful for grouping related icons. */
export function registerSvgs(entries: Record<string, string>): void {
  for (const [id, markup] of Object.entries(entries)) registerSvg(id, markup);
}

/**
 * Look up a registered SVG. Returns the markup, or an empty string in
 * production if the id is unknown. In development it throws, so the
 * miss is obvious during the dev-build smoke test.
 */
export function allowlistedSvg(id: string): string {
  const markup = _registry.get(id);
  if (markup !== undefined) return markup;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`allowlistedSvg: unregistered id "${id}"`);
  }
  return "";
}

/** Useful for tests / audits — list every registered id. */
export function listRegisteredSvgs(): readonly string[] {
  return Array.from(_registry.keys());
}
