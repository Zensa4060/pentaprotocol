import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge proxy — server-side route gate (Next.js 16+ `proxy.ts` convention).
 *
 * Phase 2.1 of the pre-launch hardening: before Next.js renders a
 * protected page's React Server Component payload, we check a
 * lightweight presence cookie (`pp_auth`) that the client writes
 * whenever a valid JWT is saved to localStorage. If the cookie is
 * missing or expired, the user is redirected to /auth.
 *
 * This is **defense in depth only**. The cookie is NOT the auth
 * credential — it only stores the token's expiry timestamp. Actual
 * authentication still happens backend-side on every API call via the
 * `Authorization: Bearer …` header, which the proxy cannot see.
 * Forging this cookie gains an attacker nothing except rendering a
 * skeleton UI that will immediately 401 on the first data fetch.
 *
 * Why not httpOnly / server-authoritative here?
 *   That's a BFF migration and is explicitly Phase 3 in
 *   docs/… — we're not touching token storage for beta launch.
 */

const PROTECTED_PREFIXES = [
  "/home",
  "/play",
  "/ranked",
  "/unranked",
  "/custom",
  "/challenge",
  "/training",
  "/rules",
  "/ready",
  "/rulechoice",
  "/rulesshow",
  "/rulebreaker",
  "/game",
  "/profile",
  "/career",
  "/missions",
  "/store",
  "/collection",
  "/patchnotes",
];

// Public surface: /auth (login/register), legal pages, static assets,
// cookie notice, root marketing page. Anything not explicitly in
// PROTECTED_PREFIXES falls through untouched.
const AUTH_PATH = "/auth";
const COOKIE_NAME = "pp_auth";

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expiryMs = cookie ? Number(cookie) : 0;

  // Missing, malformed, or expired cookie → bounce to /auth with a
  // `next` param so we can return the user where they tried to go.
  if (!expiryMs || Number.isNaN(expiryMs) || expiryMs < Date.now()) {
    const url = req.nextUrl.clone();
    url.pathname = AUTH_PATH;
    // Preserve the original path for post-login redirect. We only
    // keep the pathname+search, never the full URL, to avoid
    // open-redirect risk if this value is ever reflected.
    url.searchParams.set("next", pathname + (req.nextUrl.search || ""));
    const res = NextResponse.redirect(url);
    // Proactively clear the bad cookie so a stale expiry doesn't keep
    // bouncing the user on every navigation.
    if (cookie) {
      res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    }
    return res;
  }

  return NextResponse.next();
}

// Match every path except Next's internals, API routes (handled by the
// backend), static files, and the image optimizer. Keeping this matcher
// narrow is important — the proxy runs on every matched request and
// excess matches cost latency.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\..*).*)",
  ],
};
