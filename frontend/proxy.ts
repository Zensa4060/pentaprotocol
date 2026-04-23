import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge proxy — server-side route gate + HTTPS enforcement
 * (Next.js 16+ `proxy.ts` convention).
 *
 * Phase 2.1 — route gate:
 *   Before Next.js renders a protected page's React Server Component
 *   payload, we check a lightweight presence cookie (`pp_auth`) that
 *   the backend now writes alongside the HttpOnly `pp_token` session
 *   cookie. If the cookie is missing or expired the user is redirected
 *   to /auth.
 *
 *   This is **defense in depth only**. The cookie is NOT the auth
 *   credential — it only stores the token's expiry timestamp. Actual
 *   authentication still happens backend-side on every API call by
 *   reading the HttpOnly `pp_token` cookie (see backend/app/core/
 *   auth_dep.py). Forging `pp_auth` gains an attacker nothing except
 *   rendering a skeleton UI that will immediately 401 on the first
 *   data fetch.
 *
 *   Phase 3 update: the JWT itself now lives in the HttpOnly
 *   `pp_token` cookie (security review F-03) — inaccessible from
 *   JavaScript, so an XSS primitive in the page origin can no longer
 *   exfiltrate it. The edge proxy still checks the readable `pp_auth`
 *   hint rather than the HttpOnly cookie directly, because `pp_auth`
 *   already carries the expiry timestamp we need for the "is the
 *   session still active?" decision without decoding the JWT.
 *
 * CSP note (F-01 trade-off):
 *   We used to mint a per-request nonce here and emit a nonce-only
 *   `script-src`. In practice Next.js 16's streaming RSC pipeline
 *   does not reliably propagate the middleware nonce onto every
 *   inline `<script>` chunk it emits — edge caches, Vercel's render
 *   path, and streaming boundaries can all drop the nonce attribute
 *   on individual bootstrap fragments, producing the exact CSP
 *   violations we observed in production (blank page, hydration
 *   aborted, `Connection closed` errors). We therefore delegate CSP
 *   entirely to the static header config in `next.config.ts`, which
 *   uses `'unsafe-inline'` for `script-src`. This is a known,
 *   documented regression from F-01 until Next.js nonce propagation
 *   is reliable across streaming responses. All other hardening
 *   (`object-src 'none'`, `frame-ancestors 'none'`, tight host
 *   allowlists, `upgrade-insecure-requests`, HSTS) stays in place.
 */

// Routes that require a live account. The AppShell has its own
// soft-gate (``GUEST_BLOCKED_SCREENS`` in frontend/lib/routes.ts) that
// pops a "sign in to continue" modal when a guest tries to reach one
// of these from inside the SPA — this list exists for the *initial*
// document request, so a guest with no ``pp_auth`` cookie who types
// one of these URLs directly gets bounced to /auth before we render
// any protected UI.
//
// Notably NOT listed (guests may browse these without signing in):
// ``/home`` (main menu after "Continue as Guest"),
// ``/training`` (tutorial + local bot modes work offline),
// ``/rules``, ``/patchnotes`` (public content).
// Excluding them here fixes the old "Continue as Guest → lands on
// /auth?next=/home" loop where the proxy shadowed the SPA's guest
// support.
const PROTECTED_PREFIXES = [
  "/play",
  "/ranked",
  "/unranked",
  "/custom",
  "/challenge",
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
  "/friends",
];

// Public surface: /auth (login/register), legal pages, static assets,
// cookie notice, root marketing page. Anything not explicitly in
// PROTECTED_PREFIXES falls through untouched.
const AUTH_PATH = "/auth";
const COOKIE_NAME = "pp_auth";

const IS_PROD = process.env.NODE_ENV === "production";

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Force HTTPS in production. Vercel normally terminates TLS and
 * redirects http:// → https:// at the edge, but we've seen users land
 * on the plain-HTTP interstitial when the request path arrived via a
 * non-Vercel hop (captive-portal rewrites, some mobile browsers that
 * try http:// first before Chrome's HSTS cache warms up, etc).
 *
 * Defence-in-depth: if the incoming request says ``x-forwarded-proto:
 * http`` while we're running on a production deploy, bounce to the
 * equivalent https:// URL. The HSTS header on the https response then
 * pins the browser for the next two years (see frontend/next.config.ts).
 *
 * We intentionally skip this in dev — local servers run on plain http
 * and there is no TLS terminator to talk to.
 */
function enforceHttps(req: NextRequest): NextResponse | null {
  if (!IS_PROD) return null;
  const proto = req.headers.get("x-forwarded-proto");
  if (!proto || proto === "https") return null;
  const url = req.nextUrl.clone();
  url.protocol = "https:";
  return NextResponse.redirect(url, 308);
}

export function proxy(req: NextRequest) {
  const httpsRedirect = enforceHttps(req);
  if (httpsRedirect) return httpsRedirect;

  const { pathname } = req.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

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
