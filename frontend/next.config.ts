import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://*.supabase.co",
              "connect-src 'self' http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000 https://accounts.google.com https://www.googleapis.com https://*.supabase.co wss://*.railway.app https://*.railway.app",
              "frame-src 'self' https://accounts.google.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;