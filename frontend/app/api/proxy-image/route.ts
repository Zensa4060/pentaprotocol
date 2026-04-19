import { NextRequest, NextResponse } from "next/server";

// ──────────────────────────────────────────────────────────────────────────────
// Phase 2.5: deny-by-default in production.
//
// Before: an unset PROXY_IMAGE_ALLOWED_HOSTS env var meant "anything
// goes". That's a textbook SSRF primitive — an attacker can point this
// endpoint at internal services (localhost, AWS EC2 metadata at
// 169.254.169.254, Railway's internal DNS) and read back whatever the
// upstream returns as long as the Content-Type starts with `image/`.
//
// Now: if the allowlist is empty AND we're in production, the proxy
// refuses every request. Dev mode still allows anything (minus the
// private-IP block below) so the `next dev` experience is unchanged.
// ──────────────────────────────────────────────────────────────────────────────

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "localhost.localdomain") return true;
  // IPv4 literal? (rough but fine for this purpose)
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b, _c, _d] = v4;
    const oct1 = Number(a);
    const oct2 = Number(b);
    // 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 0/8, 100.64/10
    if (oct1 === 10) return true;
    if (oct1 === 127) return true;
    if (oct1 === 0) return true;
    if (oct1 === 169 && oct2 === 254) return true; // link-local + cloud metadata
    if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) return true;
    if (oct1 === 192 && oct2 === 168) return true;
    if (oct1 === 100 && oct2 >= 64 && oct2 <= 127) return true; // CGNAT
  }
  // IPv6 literal? any variant of loopback / link-local / unique-local.
  if (h.includes(":")) {
    if (h === "::1") return true;
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new NextResponse("Malformed url", { status: 400 });
  }
  if (parsed.protocol !== "https:") {
    return new NextResponse("Only https urls are allowed", { status: 400 });
  }

  const host = parsed.hostname.toLowerCase();
  if (isPrivateOrLoopbackHost(host)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  const allowHosts =
    (process.env.PROXY_IMAGE_ALLOWED_HOSTS || "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

  const isProd = process.env.NODE_ENV === "production";
  if (allowHosts.length === 0) {
    if (isProd) {
      return new NextResponse("Proxy disabled", { status: 403 });
    }
    // Dev: fall through and allow. Still no private IPs.
  } else if (!allowHosts.includes(host)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  const maxBytes = Number(process.env.PROXY_IMAGE_MAX_BYTES || 5 * 1024 * 1024);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(parsed.toString(), {
    signal: controller.signal,
    redirect: "follow",
    cache: "no-store",
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) return new NextResponse("Upstream fetch failed", { status: 502 });
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return new NextResponse("Unsupported content type", { status: 415 });
  }
  const contentLen = Number(response.headers.get("content-length") || 0);
  if (contentLen > maxBytes) {
    return new NextResponse("Upstream payload too large", { status: 413 });
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    return new NextResponse("Upstream payload too large", { status: 413 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
