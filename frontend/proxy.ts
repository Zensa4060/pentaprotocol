import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge proxy — server-side route gate + per-request CSP nonce
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
 * Phase 3 hardening — CSP nonce (review finding F-01):
 *   We mint a cryptographically random nonce per request and inject it
 *   into `script-src`, which lets us drop `'unsafe-inline'` from
 *   script sources entirely. Next.js automatically reads the
 *   `x-nonce` request header and attaches the nonce attribute to its
 *   own injected hydration / Flight / framework `<script>` tags, so
 *   no changes to `app/layout.tsx` are required.
 *
 *   `'unsafe-inline'` is still permitted in `style-src` — this is an
 *   accepted risk per the security review, since style-based injection
 *   has a much smaller blast radius than script execution and styled-jsx
 *   / Next inline critical CSS make a style nonce migration significantly
 *   more invasive for negligible additional security.
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
 * Edge-runtime-safe random nonce generator. 16 bytes of entropy is
 * the OWASP-recommended minimum for a CSP nonce and is base64-encoded
 * to produce a ~22-char token. `crypto.getRandomValues` and `btoa` are
 * both available in Next.js's Edge runtime.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildCsp(nonce: string): string {
  // Dev origins (localhost / 127.0.0.1 on port 8000) are only emitted
  // in non-production builds. Production always reaches the backend
  // via `NEXT_PUBLIC_API_URL` or same-origin — never localhost
  // (review finding F-02).
  const connectSources = [
    "'self'",
    ...(IS_PROD
      ? []
      : [
          "http://localhost:8000",
          "ws://localhost:8000",
          "http://127.0.0.1:8000",
          "ws://127.0.0.1:8000",
        ]),
    "https://accounts.google.com",
    "https://www.googleapis.com",
    "https://*.supabase.co",
    "wss://*.railway.app",
    "https://*.railway.app",
  ].join(" ");

  // Script sources:
  //   - 'self' covers Next's same-origin chunks
  //   - nonce-<random> permits Next's own inline hydration / Flight
  //     bootstraps (Next auto-applies this nonce when it sees the
  //     x-nonce request header)
  //   - Host allowlist covers dynamically-loaded third-party libs
  //     (Google GIS, Cloudflare Insights beacon). We intentionally do
  //     NOT use 'strict-dynamic' — it makes the host allowlist a no-op
  //     in CSP3-compliant browsers, which would break any third-party
  //     script that does not chain cleanly from a nonce-bearing root.
  //
  //   Dev also needs 'unsafe-eval' (React Fast Refresh / stack
  //   reconstruction) and 'unsafe-inline' (Turbopack HMR injects
  //   inline scripts that do not receive the nonce).
  const scriptSrc = IS_PROD
    ? [
        "script-src 'self'",
        `'nonce-${nonce}'`,
        "https://accounts.google.com",
        "https://static.cloudflareinsights.com",
      ].join(" ")
    : [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        `'nonce-${nonce}'`,
        "https://accounts.google.com",
        "https://static.cloudflareinsights.com",
      ].join(" ");

  return [
    "default-src 'self'",
    scriptSrc,
    // 'unsafe-inline' is intentionally retained for style-src per the
    // security review's explicit guidance (F-01 recommendation: "Leaving
    // 'unsafe-inline' in style-src is acceptable in the short term as
    // style-injection has a much smaller blast radius").
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com",
    "media-src 'self'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://*.supabase.co",
    `connect-src ${connectSources}`,
    "frame-src 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Build the NextResponse.next() that carries the nonce on both the
 *  request (for Next's renderer) and the response (for the browser). */
function withNonceAndCsp(req: NextRequest, nonce: string) {
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Some Next.js versions also read the CSP from the request header
  // to decide whether to emit nonce-tagged script tags at all. Setting
  // it is harmless when they don't.
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  res.headers.set("Content-Security-Policy", csp);
  return res;
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
  const nonce = generateNonce();

  if (!isProtected(pathname)) {
    return withNonceAndCsp(req, nonce);
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

  return withNonceAndCsp(req, nonce);
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
