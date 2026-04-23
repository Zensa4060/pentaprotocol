import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge proxy — HTTPS enforcement only.
 *
 * Historical note (do not re-add):
 *   This proxy used to gate protected routes by reading a lightweight
 *   ``pp_auth`` presence cookie and redirecting missing/expired sessions
 *   to ``/auth``. That worked in dev where the frontend and backend
 *   shared ``localhost`` as their site, but broke in production.
 *
 *   Our production deployment has the frontend on ``pentaprotocol.com``
 *   (Vercel) and the backend on ``*.up.railway.app`` (Railway). These
 *   are two different eTLD+1 sites. The backend sets ``pp_auth`` on
 *   its own origin, so the browser never sends the cookie to the
 *   frontend origin. The proxy — which runs on the frontend origin —
 *   therefore *always* saw a missing cookie for logged-in users and
 *   bounced them to ``/auth`` in an infinite loop (observed in prod
 *   when navigating to /career, /play/lobby, /profile, etc. while
 *   actually signed in).
 *
 *   Client-side auth gating (``AppShell`` + ``AuthGuard``) already
 *   handles the "redirect unauthenticated visitors to /auth" case
 *   correctly using the Zustand auth store, which is fed by a
 *   ``/api/auth/me`` bootstrap that works across origins thanks to
 *   ``withCredentials: true`` + ``SameSite=None; Secure`` cookies.
 *   We therefore delete the server-side cookie gate entirely rather
 *   than try to duplicate session state on the frontend origin.
 *
 * What this proxy still does:
 *   - ``enforceHttps`` — defence-in-depth http→https redirect in prod.
 *     Vercel already does this at its edge, but a misconfigured CDN
 *     hop or a captive-portal rewrite can sometimes deliver an http://
 *     request; we bounce it before Next.js ever renders anything.
 */

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Force HTTPS in production. If the incoming request arrived over
 * plain HTTP (``x-forwarded-proto: http``) while we're on a prod
 * deploy, redirect to the https:// equivalent with a 308 so browsers
 * retain the method/body on re-send. The HSTS header emitted from
 * ``next.config.ts`` then pins the browser to HTTPS for the next two
 * years.
 *
 * Skipped in dev — local servers run on plain http and there is no
 * TLS terminator to talk to.
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
