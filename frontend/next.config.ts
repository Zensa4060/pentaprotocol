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
            // CSP notes (Phase 2.4):
            //
            // - `unsafe-eval` is OMITTED in production. In `next dev` we
            //   must allow it or React throws (eval() for dev-only stack
            //   / Fast Refresh). Production never ships eval().
            //
            // - `unsafe-inline` on script-src is INTENTIONALLY KEPT
            //   for this release. Moving to a nonce-based CSP with
            //   `strict-dynamic` requires threading a per-request
            //   nonce through Next's proxy layer and every inline
            //   <Script> / framework boot fragment. That is a big
            //   refactor relative to the marginal win here — tracked
            //   for Phase 3. The rest of the policy below still cuts
            //   off the common attack classes (base-uri tampering,
            //   object/form injection, frame-ancestors clickjacking).
            //
            // - `object-src 'none'` blocks <embed>/<object>/<applet>,
            //   common malware vectors we never use.
            // - `base-uri 'self'` stops an XSS payload from rewriting
            //   the <base href> to phish tokens.
            // - `form-action 'self'` stops forms from POST-ing to
            //   attacker domains (we never submit forms cross-origin).
            // - `upgrade-insecure-requests` forces any lingering
            //   http:// asset URLs onto https:// in prod.
            value: [
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
              "connect-src 'self' http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000 https://accounts.google.com https://www.googleapis.com https://*.supabase.co wss://*.railway.app https://*.railway.app",
              "frame-src 'self' https://accounts.google.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;