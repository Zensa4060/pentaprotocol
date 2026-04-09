import { NextRequest, NextResponse } from "next/server";

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

  const allowHosts =
    (process.env.PROXY_IMAGE_ALLOWED_HOSTS || "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  if (allowHosts.length > 0 && !allowHosts.includes(parsed.hostname.toLowerCase())) {
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
