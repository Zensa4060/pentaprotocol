import type { NextConfig } from "next";

// React's development build (and some Turbopack helpers) call eval() for
// stack reconstruction and Fast Refresh. Production bundles never need
// this — keep 'unsafe-eval' out of prod CSP.
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.mp3$/i,
      type: "asset/resource",
      generator: {
        filename: "static/media/[name].[hash][ext]",
      },
    });
    return config;
  },
  // Hide the Next.js dev overlay indicator that shows "compiling" / "rendering"
  // in the bottom-left during local development. Production never shows it.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
    ],
  },
  async headers() {
    // CSP is emitted from the edge proxy (frontend/proxy.ts) so that a
    // cryptographically random per-request nonce can be threaded into
    // `script-src` and `'unsafe-inline'` can be dropped from scripts
    // entirely (Phase 3 hardening — review finding F-01). Everything
    // else that is safe to set statically stays here so we get CSP-less
    // pages (e.g. /_next/static asset responses) covered too.
    //
    // `connect-src` dev origins (localhost / 127.0.0.1 on port 8000)
    // are intentionally only emitted in non-production builds —
    // production traffic always goes to the real API origin via
    // `NEXT_PUBLIC_API_URL` or same-origin rewrites (review finding F-02).
    const connectSources = [
      "'self'",
      ...(isProd
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

    // Fallback CSP for responses that slip past the edge proxy (static
    // assets, API-less routes without a matcher hit). Script-src here
    // still allows `'unsafe-inline'` because we cannot mint a nonce in
    // a static config — the proxy overrides this with a nonce-only
    // policy on every document response.
    const fallbackCsp = [
      "default-src 'self'",
      [
        "script-src 'self' 'unsafe-inline'",
        ...(isProd ? [] : ["'unsafe-eval'"]),
        "https://accounts.google.com",
        "https://static.cloudflareinsights.com",
      ].join(" "),
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

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // HSTS — two years + includeSubDomains + preload. Vercel
          // automatically terminates TLS for pentaprotocol.com, so
          // every production response is HTTPS; this pins the browser
          // to never fall back to http:// for our host or any
          // subdomain. Local dev uses http://localhost — HSTS headers
          // served from a non-HTTPS origin are ignored by browsers, so
          // this is safe to set unconditionally.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: fallbackCsp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
