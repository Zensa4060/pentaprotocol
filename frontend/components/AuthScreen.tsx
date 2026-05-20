"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuthStore } from "@/lib/store";
import { POLICY_GATE_SESSION_KEY, getUserId } from "@/lib/legalAcceptance";
import { THEMES } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import API from "@/lib/api";

function validateUsername(val: string): string | null {
  if (val.length < 3) return "Minimum 3 characters";
  if (val.length > 12) return "Maximum 12 characters";
  if (val.startsWith(" ") || val.endsWith(" ")) return "Cannot start or end with a space";
  if (/\s{2,}/.test(val)) return "Only single spaces allowed";
  if (/[^\w\s]/.test(val)) return "No special characters allowed";
  return null;
}

type AuthTab = "signin" | "signup" | "forgot" | "verify_code" | "2fa_check" | "verify_signup" | "merge_consent";

/** Subset of `useAudio()` passed from AppShell so auth can tune BGM before sign-in. */
export type AuthScreenAudio = {
  musicVol: number;
  setMusicVol: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
};

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
  audio?: AuthScreenAudio;
}

type ParticleSettings = {
  count: number;
  connect: number;
  attractRadius: number;
  attractForce: number;
  maxSpeed: number;
};

const DEFAULT_PARTICLE_SETTINGS: ParticleSettings = {
  count: 500,
  connect: 100,
  attractRadius: 100,
  attractForce: 250,
  maxSpeed: 10,
};

function ParticleCanvas({ settings }: { settings: ParticleSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Live ref so slider changes don't tear down + reseed the whole RAF loop.
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // alpha:false → the browser knows the canvas is fully opaque, so it
    // skips per-pixel compositing against the page background. Big win
    // for the trail-fade fillRect (the single most expensive op here)
    // and the per-particle drawImage blits.
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // This is a decorative background that already lives under a dark
    // vignette + edge-fade gradient — retina sharpness here is invisible
    // to the user but doubles fill/blit cost on hi-DPI screens. Pinning
    // DPR to 1 cuts backbuffer pixel count by 2.25–4× on phones/4K
    // monitors and is the single biggest fps win.
    const dpr = 1;
    let W = 0, H = 0;
    let animId = 0;
    let running = true;
    let visible = typeof document !== "undefined" ? !document.hidden : true;
    const mouse = { x: -9999, y: -9999 };
    // Cache the canvas rect — getBoundingClientRect() forces a layout
    // flush, so doing it inside mousemove (which can fire 1000+ Hz on
    // some trackpads) interleaves badly with the RAF loop and causes
    // visible jank. Refresh only on resize + scroll instead.
    let rectLeft = 0, rectTop = 0;

    const refreshRect = () => {
      const r = canvas.getBoundingClientRect();
      rectLeft = r.left;
      rectTop = r.top;
    };

    const resize = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      W = w; H = h;
      canvas.width  = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#030303";
      ctx.fillRect(0, 0, W, H);
      refreshRect();
    };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX - rectLeft;
      mouse.y = e.clientY - rectTop;
    };
    const onMouseLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onVisibility = () => { visible = !document.hidden; };

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", refreshRect, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    canvas.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();

    // Pre-render glow sprites once. Blitting a cached sprite via drawImage is
    // ~100x cheaper than ctx.shadowBlur on every particle, every frame.
    const makeGlow = (core: string, mid: string, radius: number) => {
      const size = Math.ceil(radius * 4);
      const off = document.createElement("canvas");
      off.width = off.height = size;
      const g = off.getContext("2d");
      if (!g) return off;
      const cx = size / 2;
      const grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
      grad.addColorStop(0, core);
      grad.addColorStop(0.35, mid);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      return off;
    };
    const glowNormal = makeGlow("rgba(204,0,0,1)",   "rgba(204,0,0,0.55)", 5);
    const glowBright = makeGlow("rgba(255,90,90,1)", "rgba(255,68,68,0.6)", 7);
    const gnHalf = glowNormal.width / 2;
    const gbHalf = glowBright.width / 2;

    // ── Particle state in parallel typed arrays ──────────────────────
    // Hot-path reads (`p.x`, `p.vx`, …) on objects-in-an-array each go
    // through a hidden-class lookup. Float32Array reads compile to a
    // single load and pack the data tightly in L1, which makes the
    // per-frame physics ~3× faster at 500 particles. Capacity grows on
    // demand so the count slider doesn't trigger reallocations every
    // time it moves.
    let capacity = 0;
    let xs = new Float32Array(0);
    let ys = new Float32Array(0);
    let vxs = new Float32Array(0);
    let vys = new Float32Array(0);
    let bright = new Uint8Array(0);
    let nextLink = new Int32Array(0); // particle → next-in-bucket index
    let currentCount = -1;

    const ensureCapacity = (count: number) => {
      if (count <= capacity) return;
      // Grow geometrically to avoid quadratic-time slider drags.
      const cap = Math.max(count, Math.floor(capacity * 1.5) + 32);
      const nXs = new Float32Array(cap);   nXs.set(xs);    xs = nXs;
      const nYs = new Float32Array(cap);   nYs.set(ys);    ys = nYs;
      const nVxs = new Float32Array(cap);  nVxs.set(vxs);  vxs = nVxs;
      const nVys = new Float32Array(cap);  nVys.set(vys);  vys = nVys;
      const nBright = new Uint8Array(cap); nBright.set(bright); bright = nBright;
      nextLink = new Int32Array(cap);
      capacity = cap;
    };

    const seed = (count: number) => {
      ensureCapacity(count);
      currentCount = count;
      for (let i = 0; i < count; i++) {
        xs[i]  = Math.random() * W;
        ys[i]  = Math.random() * H;
        vxs[i] = (Math.random() - 0.5) * 0.79;
        vys[i] = (Math.random() - 0.5) * 0.79;
        bright[i] = Math.random() < 0.15 ? 1 : 0;
      }
    };

    // ── Linked-list spatial hash ─────────────────────────────────────
    // The old implementation re-allocated ~hundreds of small bucket
    // arrays + a Map every frame, which was the main source of GC
    // hiccups on long-lived auth screens (Chrome's young-gen kicks in
    // every ~150ms under that pressure). The flat-array version reuses
    // two Int32Arrays forever: bucketHead[cell] holds the index of the
    // most recently inserted particle in that cell (or −1), and
    // nextLink[particle] holds the index of the next particle in the
    // same cell. Walking the chain is just `j = nextLink[j]` until −1.
    let cellSize = 0;
    let cols = 0;
    let rows = 0;
    let bucketHead = new Int32Array(0);

    const ensureGrid = (cell: number) => {
      const newCols = Math.max(1, Math.ceil(W / cell));
      const newRows = Math.max(1, Math.ceil(H / cell));
      if (cell === cellSize && newCols === cols && newRows === rows) return;
      cellSize = cell;
      cols = newCols;
      rows = newRows;
      bucketHead = new Int32Array(cols * rows);
    };

    // ── Fixed-step RAF (60 fps cap, frame-rate independent) ──────────
    // requestAnimationFrame fires at the display's refresh rate, which
    // is 120/144/165 Hz on most current laptops and phones. Without a
    // cap we did 2–2.75× more work per second for zero visual gain. The
    // accumulator drains in 1/60 s slices, so 120 Hz screens get one
    // update per two RAF callbacks, 144 Hz screens get an update every
    // ~2.4 callbacks, and 60 Hz screens get exactly one per callback.
    // If the tab is buried for a while we clamp the catch-up to a
    // single step so we don't run hundreds of physics ticks back-to-
    // back when it returns.
    const STEP_MS = 1000 / 60;
    let lastTs = 0;
    let frameParity = 0;

    const tick = (ts: number) => {
      if (!running) return;
      animId = requestAnimationFrame(tick);
      if (!visible) { lastTs = ts; return; }
      if (lastTs === 0) lastTs = ts;
      let elapsed = ts - lastTs;
      if (elapsed < STEP_MS - 0.5) return;
      // Clamp catch-up: at most 2 sim ticks per RAF callback. Beyond
      // that just snap forward so the system stays responsive after
      // long pauses (tab switch, OS sleep, etc.).
      if (elapsed > STEP_MS * 3) elapsed = STEP_MS;
      lastTs = ts - (elapsed % STEP_MS);
      step();
    };

    const step = () => {
      const s = settingsRef.current;
      const count = s.count;
      const connect = s.connect;
      const attractRadius = s.attractRadius;
      const attractForce = s.attractForce;
      const maxSpeed = s.maxSpeed;
      if (count !== currentCount) seed(count);

      // Trail fade every other frame. At 60 fps the strobe is well
      // below perceptual threshold (the eye averages over ~33 ms), but
      // it halves the cost of the single most expensive op in the loop
      // — filling the entire canvas with a semi-transparent rect.
      frameParity ^= 1;
      if (frameParity === 0) {
        ctx.fillStyle = "rgba(3,3,3,0.4)";
        ctx.fillRect(0, 0, W, H);
      }

      const ar2 = attractRadius * attractRadius;
      const ms2 = maxSpeed * maxSpeed;
      const ptsLen = count;
      const mx = mouse.x, my = mouse.y;

      // Physics — tight loop on Float32Arrays. No method calls, no
      // allocations, no object property hops.
      for (let i = 0; i < ptsLen; i++) {
        let px = xs[i], py = ys[i];
        let vx = vxs[i], vy = vys[i];
        const dx = mx - px, dy = my - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < ar2 && d2 > 0) {
          const dist = Math.sqrt(d2);
          const force = (1 - dist / attractRadius) * attractForce;
          const inv = force / dist;
          vx += dx * inv;
          vy += dy * inv;
        }
        vx *= 0.98; vy *= 0.98;
        const sp2 = vx * vx + vy * vy;
        if (sp2 > ms2) {
          const inv = maxSpeed / Math.sqrt(sp2);
          vx *= inv; vy *= inv;
        }
        px += vx; py += vy;
        if (px < 0) px = W; else if (px > W) px = 0;
        if (py < 0) py = H; else if (py > H) py = 0;
        xs[i] = px; ys[i] = py;
        vxs[i] = vx; vys[i] = vy;
      }

      // Bin particles into the linked-list spatial grid.
      const cell = Math.max(1, connect);
      ensureGrid(cell);
      bucketHead.fill(-1);
      for (let i = 0; i < ptsLen; i++) {
        let cx = (xs[i] / cell) | 0;
        let cy = (ys[i] / cell) | 0;
        if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
        if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
        const k = cx + cy * cols;
        nextLink[i] = bucketHead[k];
        bucketHead[k] = i;
      }

      // Single batched stroke for all connection lines. Walking the
      // linked list per neighbour cell keeps the hot loop branch-light
      // and cache-friendly.
      const conn2 = connect * connect;
      ctx.beginPath();
      for (let i = 0; i < ptsLen; i++) {
        const ax = xs[i], ay = ys[i];
        let cx = (ax / cell) | 0;
        let cy = (ay / cell) | 0;
        if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
        if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
        for (let oy = -1; oy <= 1; oy++) {
          const ny = cy + oy;
          if (ny < 0 || ny >= rows) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const nx = cx + ox;
            if (nx < 0 || nx >= cols) continue;
            let j = bucketHead[nx + ny * cols];
            while (j !== -1) {
              if (j > i) {
                const ddx = ax - xs[j];
                const ddy = ay - ys[j];
                const dd = ddx * ddx + ddy * ddy;
                if (dd < conn2) {
                  ctx.moveTo(ax, ay);
                  ctx.lineTo(xs[j], ys[j]);
                }
              }
              j = nextLink[j];
            }
          }
        }
      }
      ctx.strokeStyle = "rgba(204,0,0,0.45)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Particles via cached glow sprites (no shadowBlur → no GPU back-pressure).
      for (let i = 0; i < ptsLen; i++) {
        if (bright[i]) {
          ctx.drawImage(glowBright, xs[i] - gbHalf, ys[i] - gbHalf);
        } else {
          ctx.drawImage(glowNormal, xs[i] - gnHalf, ys[i] - gnHalf);
        }
      }
    };

    animId = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", refreshRect);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      // willChange + translateZ promote the canvas to its own GPU
      // compositor layer, so paints don't trigger a recomposite of the
      // whole left panel (logo, title, vignette gradient, edge fades).
      // backfaceVisibility:"hidden" is the WebKit-friendly twin of
      // translateZ and is a no-op everywhere else.
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        willChange: "transform",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    />
  );
}

// ── Google SVG Icon ────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function AuthScreen({ setScreenAction, themeId, audio }: Props) {
  const t = THEMES[themeId];
  const { setAuth, logout } = useAuthStore();
  const debugSentRef = useRef(0);
  const apiFallbackBase = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
  const authDebug = (...args: unknown[]) => {
    // Temporary diagnostics for mobile-login failures. Remove after investigation.
    console.log("[AuthScreen]", ...args);
    if (debugSentRef.current >= 60) return;
    debugSentRef.current += 1;
    const [stage, details] = args;
    const stageText = typeof stage === "string" ? stage : "event";
    void API.post("/api/auth/client-debug", {
      stage: stageText,
      ts_ms: Date.now(),
      page: typeof window !== "undefined" ? window.location.pathname : "n/a",
      details: details ?? null,
    }, { timeout: 4000 }).catch(() => {});
  };
  const shouldRetryWithFallbackBase = (err: any) => {
    const status = err?.response?.status;
    const isLikelyRouteMiss = status === 404 || status === 405;
    const isNetworkish =
      !err?.response &&
      (err?.code === "ERR_NETWORK" ||
        err?.code === "ECONNABORTED" ||
        /network|fetch|timeout/i.test(String(err?.message ?? "")));
    return !!apiFallbackBase && (isLikelyRouteMiss || isNetworkish);
  };
  const postWithApiFallback = async (url: string, data?: any, config?: any) => {
    try {
      return await API.post(url, data, config);
    } catch (err: any) {
      if (!shouldRetryWithFallbackBase(err)) throw err;
      authDebug("api:fallback:post", { url, fallbackBase: apiFallbackBase, code: err?.code, status: err?.response?.status });
      return await API.post(url, data, { ...(config ?? {}), baseURL: apiFallbackBase });
    }
  };
  const getWithApiFallback = async (url: string, config?: any) => {
    try {
      return await API.get(url, config);
    } catch (err: any) {
      if (!shouldRetryWithFallbackBase(err)) throw err;
      authDebug("api:fallback:get", { url, fallbackBase: apiFallbackBase, code: err?.code, status: err?.response?.status });
      return await API.get(url, { ...(config ?? {}), baseURL: apiFallbackBase });
    }
  };

  const ACCENT  = "#CC0000";
  const ACCENT2 = "#ffffff";
  const FONT    = "'Georgia', 'Times New Roman', serif";
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  // ── STATE ─────────────────────────────────────────────
  const [tab, setTab]               = useState<AuthTab>("signin");
  const [username, setUsername]     = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [forgotEmail, setForgotEmail]   = useState("");
  const [resetCode, setResetCode]   = useState("");
  const [newPassword, setNewPassword]   = useState("");
  const [newConfirm, setNewConfirm]     = useState("");
  const [signupOtp, setSignupOtp]   = useState("");
  const [totpCode, setTotpCode]     = useState("");
  const [tempToken, setTempToken]   = useState("");
  const [pendingGoogleCred, setPendingGoogleCred] = useState("");
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(false);
  const [shake, setShake]           = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady]     = useState(false);
  /**
   * iOS Safari (and every in-app WKWebView like Instagram / Facebook / X)
   * breaks the classic `oauth2.initTokenClient` popup flow because:
   *   1) Safari's popup blocker kills `window.open` when GIS does any async
   *      work between the user tap and the popup — the gesture token expires.
   *   2) ITP strips third-party cookies for `accounts.google.com`, so even
   *      if the popup opens, the session cannot post back.
   *   3) Google returns `disallowed_useragent` inside in-app browsers.
   * For real iOS Safari we hand the sign-in off to the modern Google Identity
   * Services ID-token flow (`accounts.id.initialize` + `renderButton`), which
   * uses FedCM / postMessage instead of a popup and returns a JWT credential
   * the backend already accepts (see `POST /api/auth/google`). For in-app
   * browsers we short-circuit with a "open in Safari" hint because no client
   * fix can work around Google's WKWebView block.
   */
  const isIosSafari = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const iOSLegacy = /iPad|iPhone|iPod/.test(ua);
    // iPadOS 13+ reports as "MacIntel" + touch — treat as iOS Safari too.
    const iPadOS = platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1;
    return iOSLegacy || iPadOS;
  }, []);
  const isInAppBrowser = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /FBAN|FBAV|Instagram|Twitter|TikTok|Line\/|MicroMessenger|Snapchat|LinkedInApp/i.test(ua);
  }, []);
  const googleButtonSlotRef = useRef<HTMLDivElement | null>(null);
  const [googleIdInitialized, setGoogleIdInitialized] = useState(false);
  const [particleSettings, setParticleSettings] = useState<ParticleSettings>(DEFAULT_PARTICLE_SETTINGS);
  const [showParticleControls, setShowParticleControls] = useState(false);

  // ── UTILITIES ─────────────────────────────────────────
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 420);
  }, []);

  const finalizeSession = useCallback(async (
    userPayload: any,
    accessToken: string,
    requiresPolicyGate: boolean,
  ) => {
    authDebug("finalizeSession:start", {
      requiresPolicyGate,
      hasUserId: !!getUserId(userPayload),
      hasAccessToken: typeof accessToken === "string" && accessToken.length > 0,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
    });
    const uid = getUserId(userPayload);
    if (requiresPolicyGate && uid) {
      try {
        sessionStorage.setItem(POLICY_GATE_SESSION_KEY, uid);
        authDebug("finalizeSession:sessionStorage policy gate set", { uid });
      } catch {
        // Storage can fail on some mobile/privacy contexts.
        authDebug("finalizeSession:sessionStorage policy gate FAILED");
      }
    }

    setAuth(userPayload, accessToken, staySignedIn);
    authDebug("finalizeSession:setAuth called", {
      ppAuthCookiePresent:
        typeof document !== "undefined" ? document.cookie.includes("pp_auth=") : false,
    });

    try {
      const profileRes = await getWithApiFallback("/api/profile/me", { timeout: 10000 });
      authDebug("finalizeSession:profile verification OK", {
        status: profileRes?.status,
        hasUser: !!profileRes?.data,
      });
    } catch (err: any) {
      const status = err?.response?.status;
      authDebug("finalizeSession:profile verification FAILED", {
        status,
        detail: err?.response?.data?.detail,
        code: err?.code,
        message: err?.message,
        ppAuthCookiePresent:
          typeof document !== "undefined" ? document.cookie.includes("pp_auth=") : false,
      });
      if (status === 401 || status === 403) {
        logout();
        setErrors({
          general:
            "Sign-in succeeded, but this browser blocked the session cookie. Please open in Safari/Chrome (not an in-app browser) and try again.",
        });
        triggerShake();
        return false;
      }
    }

    authDebug("finalizeSession:navigating", {
      destination: requiresPolicyGate ? "policy_gate" : "home",
    });
    setScreenAction(requiresPolicyGate ? "policy_gate" : "home");
    return true;
  }, [logout, setAuth, setScreenAction, staySignedIn, triggerShake]);

  // ── GOOGLE AUTH ───────────────────────────────────────
  /**
   * Shared post-exchange handler. Given either an OAuth access token (popup
   * flow) or an ID-token JWT (iOS Safari / FedCM flow), hit the backend and
   * drive the UI through merge-consent / policy-gate / home. The backend
   * accepts both shapes under `credential` (see `auth.py::google_auth`).
   */
  const exchangeGoogleCredential = useCallback(async (credential: string) => {
    authDebug("google:exchange:start", {
      credentialLength: typeof credential === "string" ? credential.length : 0,
    });
    setGoogleLoading(true);
    setErrors({});
    setSuccessMsg("");
    try {
      const res = await postWithApiFallback("/api/auth/google", { credential });
      authDebug("google:exchange:response", {
        status: res?.status,
        requiresMergeConsent: !!res?.data?.requires_merge_consent,
        requiresPolicyGate: !!res?.data?.requires_policy_gate,
      });

      if (res.data.requires_merge_consent) {
        setPendingGoogleCred(credential);
        setTab("merge_consent");
        authDebug("google:exchange:requires merge consent");
        return;
      }

      if (res.data.requires_policy_gate) {
        await finalizeSession(res.data.user, res.data.access_token, true);
      } else {
        await finalizeSession(res.data.user, res.data.access_token, false);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      authDebug("google:exchange:FAILED", {
        status: err?.response?.status,
        detail,
        code: err?.code,
        message: err?.message,
      });
      setErrors({
        general:
          typeof detail === "string"
            ? detail
            : "Google sign-in failed. Network or API routing issue detected (check NEXT_PUBLIC_API_URL / rewrite).",
      });
      triggerShake();
    } finally {
      setGoogleLoading(false);
    }
  }, [setAuth, setScreenAction, staySignedIn, triggerShake]);

  const triggerGoogleSignIn = useCallback(() => {
    authDebug("google:trigger", {
      googleReady,
      googleLoading,
      isIosSafari,
      isInAppBrowser,
      hasClientId: !!GOOGLE_CLIENT_ID,
    });
    if (!GOOGLE_CLIENT_ID || googleLoading) return;

    // In-app browsers (Instagram, Facebook, X, TikTok, etc.) are blocked by
    // Google with `disallowed_useragent`. No OAuth flow we can run here will
    // succeed — tell the user to open in their real browser.
    if (isInAppBrowser) {
      setErrors({
        general: "Google sign-in is blocked inside in-app browsers. Please tap the ••• menu and choose \"Open in Safari\" (or your default browser) to continue.",
      });
      return;
    }

    // iOS Safari path: programmatically click Google's hidden rendered
    // button so FedCM / postMessage handles the flow instead of a popup.
    // The click is dispatched synchronously from this user-gesture handler,
    // which preserves activation through to Google's iframe.
    if (isIosSafari) {
      const slot = googleButtonSlotRef.current;
      const gbtn = slot?.querySelector('div[role="button"]') as HTMLElement | null;
      if (gbtn) {
        gbtn.click();
        return;
      }
      // GIS script not ready yet — fall through to surface the loading
      // state rather than blow up silently.
      setErrors({ general: "Google Sign-In is still loading — please try again." });
      return;
    }

    // Desktop / Android path: the popup OAuth2 flow works fine and gives
    // us an access token, which the backend accepts equivalently.
    const win = window as any;
    if (!win.google?.accounts?.oauth2) {
      setErrors({ general: "Google Sign-In is still loading — please try again." });
      return;
    }

    const client = win.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error) {
          setErrors({ general: "Google sign-in was cancelled or failed." });
          return;
        }
        await exchangeGoogleCredential(tokenResponse.access_token);
      },
    });

    client.requestAccessToken({ prompt: "select_account" });
  }, [GOOGLE_CLIENT_ID, googleLoading, isIosSafari, isInAppBrowser, exchangeGoogleCredential]);

  // ── EFFECTS ───────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load GIS script once
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if ((window as any).google?.accounts?.id) { setGoogleReady(true); return; }
    if (document.getElementById("google-gis-script")) return;
    const script = document.createElement("script");
    script.id  = "google-gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => console.warn("Google GIS script failed to load");
    document.head.appendChild(script);
  }, [GOOGLE_CLIENT_ID]);

  /**
   * Initialize the Google Identity Services ID-token flow exactly once, as
   * soon as the GIS script is ready. The `callback` receives a JWT credential
   * which our backend verifies via `google-auth` (access-token path still
   * works, so we haven't broken the desktop popup flow above). We render an
   * invisible-but-interactive Google button into `googleButtonSlotRef` so we
   * can synthesize a click from our styled iOS button — FedCM / the GIS
   * iframe accepts that as a trusted gesture and completes without a popup.
   */
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (!googleReady) return;
    if (googleIdInitialized) return;
    const g = (window as any).google;
    if (!g?.accounts?.id) return;
    try {
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: { credential?: string; error?: string }) => {
          if (!resp?.credential) {
            if (resp?.error) {
              setErrors({ general: "Google sign-in was cancelled or failed." });
            }
            return;
          }
          void exchangeGoogleCredential(resp.credential);
        },
        auto_select: false,
        use_fedcm_for_prompt: true,
        itp_support: true,
        ux_mode: "popup",
        context: "signin",
      });
      setGoogleIdInitialized(true);
    } catch (e) {
      console.warn("Google Identity Services init failed", e);
    }
  }, [GOOGLE_CLIENT_ID, googleReady, googleIdInitialized, exchangeGoogleCredential]);

  /**
   * Render Google's official sign-in button into the hidden slot whenever
   * GIS is initialized *and* we're on iOS Safari (where we need it as the
   * real click target). We keep it visually offscreen so our own styled
   * button stays the UI — but still interactive so `.click()` dispatches
   * through to Google's handler. Re-runs if the slot remounts (e.g. when
   * the user switches between signin / signup tabs).
   */
  useEffect(() => {
    if (!googleIdInitialized) return;
    if (!isIosSafari) return;
    const slot = googleButtonSlotRef.current;
    if (!slot) return;
    const g = (window as any).google;
    if (!g?.accounts?.id) return;
    slot.innerHTML = "";
    try {
      g.accounts.id.renderButton(slot, {
        type: "standard",
        theme: "filled_blue",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        logo_alignment: "left",
        width: 280,
      });
    } catch (e) {
      console.warn("Google Identity Services renderButton failed", e);
    }
  }, [googleIdInitialized, isIosSafari, tab]);

  // ── HANDLERS ──────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (tab === "signup") {
      const ue = validateUsername(username); if (ue) e.username = ue;
      if (!email.includes("@") || !email.includes(".")) e.email = "Enter a valid email";
      const dobVal = (errors as any)?._dob_value;
      if (!dobVal) {
        e.dob = "Date of birth is required";
      } else {
        const dob = new Date(dobVal);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const mDiff = today.getMonth() - dob.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
        if (age < 13) e.dob = "You must be at least 13 years old";
      }
    } else if (tab === "signin") {
      if (!username.trim()) e.username = "Username or email required";
    }
    if (tab === "signin" || tab === "signup") {
      if (password.length < 6) e.password = "Minimum 6 characters";
      if (tab === "signup" && password !== confirm) e.confirm = "Passwords do not match";
    }
    return e;
  };

  const submit = async () => {
    authDebug("submit:start", { tab, usernameLength: username.length, hasPassword: password.length > 0 });
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); triggerShake(); return; }
    setErrors({}); setSuccessMsg(""); setLoading(true);
    try {
      if (tab === "signup") {
        await API.post("/api/otp/signup/send", { email });
        setSuccessMsg(`A 6-digit code has been sent to ${email}`);
        setTab("verify_signup");
        return;
      }
      // Device-token is now carried in the HttpOnly pp_device_token
      // cookie — the browser attaches it automatically. We still send
      // the body field for transitional backends, but it's null post
      // F-03 (the localStorage entry no longer exists).
      const res = await API.post("/api/auth/login", {
        username, password,
      });
      authDebug("submit:login response", {
        status: res?.status,
        requires2fa: !!res?.data?.requires_2fa,
      });
      if (res.data.requires_2fa) { setTempToken(res.data.temp_token); setTab("2fa_check"); return; }
      // F-03: backend has already set pp_token + pp_device_token
      // HttpOnly cookies on the response. Nothing to persist locally.
      await finalizeSession(res.data.user, res.data.access_token, false);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      authDebug("submit:FAILED", {
        status: err?.response?.status,
        detail,
        code: err?.code,
        message: err?.message,
      });
      setErrors({ general: typeof detail === "string" ? detail : "Invalid credentials or server error" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const submitSignupOtp = async () => {
    if (signupOtp.trim().length !== 6) { setErrors({ signupOtp: "Enter the 6-digit code" }); triggerShake(); return; }
    setErrors({}); setSuccessMsg(""); setLoading(true);
    try {
      await API.post("/api/otp/signup/verify", { email, otp: signupOtp.trim() });
      const res = await API.post("/api/auth/register", { username, email, password });
      const newUser = res.data.user;
      await finalizeSession(newUser, res.data.access_token, true);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ signupOtp: typeof detail === "string" ? detail : "Invalid or expired code" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const submitForgot = async () => {
    if (!forgotEmail.includes("@") || !forgotEmail.includes(".")) { setErrors({ forgotEmail: "Enter a valid email" }); triggerShake(); return; }
    setErrors({}); setSuccessMsg(""); setLoading(true);
    try {
      await API.post("/api/auth/forgot-password", { email: forgotEmail });
      setSuccessMsg("A 6-digit code has been sent to your email.");
      setTab("verify_code");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ forgotEmail: typeof detail === "string" ? detail : "Could not send reset email" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const submitReset = async () => {
    const e: Record<string, string> = {};
    if (resetCode.trim().length !== 6) e.resetCode = "Enter the 6-digit code";
    if (newPassword.length < 6) e.newPassword = "Minimum 6 characters";
    if (newPassword !== newConfirm) e.newConfirm = "Passwords do not match";
    if (Object.keys(e).length > 0) { setErrors(e); triggerShake(); return; }
    setErrors({}); setSuccessMsg(""); setLoading(true);
    try {
      await API.post("/api/auth/reset-password", { email: forgotEmail, code: resetCode.trim(), new_password: newPassword });
      setSuccessMsg("Password reset! You can now sign in.");
      setTab("signin");
      setForgotEmail(""); setResetCode(""); setNewPassword(""); setNewConfirm("");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ resetCode: typeof detail === "string" ? detail : "Invalid or expired code" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const submit2FA = async () => {
    if (totpCode.trim().length !== 6) { setErrors({ totpCode: "Enter the 6-digit code" }); triggerShake(); return; }
    setErrors({}); setSuccessMsg(""); setLoading(true);
    try {
      const res = await API.post("/api/auth/2fa/login", { temp_token: tempToken, code: totpCode.trim() });
      // F-03: device_token is returned in the body for legacy clients
      // but the server has already set it as an HttpOnly cookie, so
      // we deliberately do NOT write it to localStorage.
      await finalizeSession(res.data.user, res.data.access_token, false);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ totpCode: typeof detail === "string" ? detail : "Invalid code" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const submitMergeConsent = async () => {
    setLoading(true); setErrors({}); setSuccessMsg("");
    try {
      const res = await API.post("/api/auth/google", {
        credential: pendingGoogleCred,
        confirm_merge: true
      });
      if (res.data.requires_policy_gate) {
        await finalizeSession(res.data.user, res.data.access_token, true);
      } else {
        await finalizeSession(res.data.user, res.data.access_token, false);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ general: typeof detail === "string" ? detail : "Merge failed." });
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (tab === "signin" || tab === "signup") submit();
    else if (tab === "forgot") submitForgot();
    else if (tab === "verify_code") submitReset();
    else if (tab === "2fa_check") submit2FA();
    else if (tab === "verify_signup") submitSignupOtp();
  };

  // ── RENDER HELPERS ────────────────────────────────────
  const inputStyle = (error: boolean): React.CSSProperties => ({
    width: "100%", paddingTop: isMobile ? 12 : 10, paddingBottom: isMobile ? 12 : 10, paddingLeft: 13, paddingRight: 13,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${error ? ACCENT2 : "rgba(255,255,255,0.1)"}`,
    borderRadius: 8, color: "#fff",
    fontFamily: FONT, fontSize: isMobile ? 16 : 15,
    outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: FONT, fontSize: 11.6, color: "#aaa",
    letterSpacing: "0.18em", marginBottom: 6, textTransform: "uppercase",
  };

  const errorStyle: React.CSSProperties = { color: ACCENT2, fontSize: 12, marginTop: 4, fontFamily: FONT };
  const sliderValueStyle: React.CSSProperties = { minWidth: 52, textAlign: "right", color: "#ddd", fontSize: 12, fontFamily: FONT };

  const updateParticleSetting = (key: keyof ParticleSettings, value: number) => {
    setParticleSettings(prev => ({ ...prev, [key]: value }));
  };

  const field = (key: string, label: string, value: string, onChange: (v: string) => void, error: string, placeholder: string, type = "text") => (
    <div style={{ marginBottom: isMobile ? 10 : 14 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setErrors(er => ({ ...er, [key]: "" })); }}
        onKeyDown={handleKeyDown} style={inputStyle(!!error)}
        onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
        onBlur={e  => { e.target.style.borderColor = error ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
      />
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );

  const passwordField = (key: string, label: string, value: string, onChange: (v: string) => void, error: string, placeholder: string, show: boolean, setShow: (v: boolean) => void) => (
    <div style={{ marginBottom: isMobile ? 10 : 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={show ? "text" : "password"} value={value} placeholder={placeholder}
          onChange={e => { onChange(e.target.value); setErrors(er => ({ ...er, [key]: "" })); }}
          onKeyDown={handleKeyDown} style={{ ...inputStyle(!!error), paddingRight: 42 }}
          onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
          onBlur={e  => { e.target.style.borderColor = error ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
        />
        <button type="button" onClick={() => setShow(!show)} tabIndex={-1}
          style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.45, color: "#fff", display: "flex", alignItems: "center" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.45"}
        >
          {show
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          }
        </button>
      </div>
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );

  const Checkbox = ({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) => (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: 6, userSelect: "none" }}>
      <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${checked ? ACCENT : "rgba(255,255,255,0.2)"}`, background: checked ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
        {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontFamily: FONT, fontSize: 13.7, color: "#aaa" }}>{label}</span>
    </div>
  );

  const PrimaryBtn = ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ width: "100%", padding: isMobile ? "14px" : "11px", background: disabled ? "#111" : "#1c1c1c", border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)"}`, borderRadius: 8, color: disabled ? "rgba(255,255,255,0.3)" : "#fff", fontFamily: FONT, fontSize: isMobile ? 15 : 14, fontWeight: 700, letterSpacing: "0.1em", cursor: disabled ? "not-allowed" : "pointer", textTransform: "uppercase", boxShadow: disabled ? "none" : "0 2px 12px rgba(0,0,0,0.6)", transition: "all 0.18s", marginTop: 8 }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = "#2a2a2a"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.8)"; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.6)"; } }}
    >{label}</button>
  );

  const GhostBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}
      style={{ width: "100%", padding: isMobile ? "13px" : "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#999", fontFamily: FONT, fontSize: 13.7, fontWeight: 600, letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase", transition: "all 0.18s", marginTop: 6 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#999"; }}
    >{label}</button>
  );

  // ── Reusable Google Button ─────────────────────────────
  const GoogleBtn = ({ label }: { label: string }) => (
    <>
      <button
        onClick={triggerGoogleSignIn}
        disabled={googleLoading || !googleReady}
        style={{
          width: "100%", padding: isMobile ? "13px 16px" : "10px 16px",
          background: (googleLoading || !googleReady) ? "#1a1a1a" : "#ffffff",
          border: `1px solid ${(googleLoading || !googleReady) ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.18)"}`,
          borderRadius: 8,
          cursor: (googleLoading || !googleReady) ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          transition: "all 0.18s", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          marginTop: 6,
        }}
        onMouseEnter={e => { if (!googleLoading && googleReady) e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.6)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)"; }}
      >
        {!googleLoading && googleReady && <GoogleIcon />}
        <span style={{ fontFamily: FONT, fontSize: isMobile ? 14 : 13, fontWeight: 600, color: (googleLoading || !googleReady) ? "#555" : "#333", letterSpacing: "0.05em" }}>
          {googleLoading ? "Please wait…" : !googleReady ? "Loading Google…" : label}
        </span>
      </button>
      {/*
        Hidden Google Identity Services button (iOS Safari only). It must
        remain in the DOM, sized non-zero, and interactive so `.click()`
        from our styled button above dispatches as a real user gesture
        through to Google's FedCM / postMessage handlers. Visibility is
        driven only by offset + opacity — `display: none` and
        `visibility: hidden` would disable the embedded iframe.
      */}
      {isIosSafari && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -9999,
            top: -9999,
            width: 280,
            height: 50,
            opacity: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <div ref={googleButtonSlotRef} style={{ pointerEvents: "auto" }} />
        </div>
      )}
      {isInAppBrowser && (
        <div
          style={{
            marginTop: 6,
            fontFamily: FONT,
            fontSize: 12,
            color: "#ffb199",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Using Instagram / Facebook / X in-app browser? Google blocks sign-in
          here — tap the ••• menu and choose &quot;Open in Safari&quot; first.
        </div>
      )}
    </>
  );

  const OrDivider = ({ text = "or" }: { text?: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 2px" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
      <span style={{ fontFamily: FONT, fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2, display: "flex", flexDirection: isMobile ? "column" : "row", background: "#030303", overflowY: isMobile ? "auto" : "hidden" }}>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        .pp-auth-shake { animation: shake 0.42s ease; }
        @keyframes fadeInLeft { from{opacity:0;transform:translateX(-22px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeInRight { from{opacity:0;transform:translateX(22px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .pp-left  { animation: fadeInLeft  0.6s cubic-bezier(.22,.68,0,1.1) both; }
        .pp-right { animation: fadeInRight 0.55s cubic-bezier(.22,.68,0,1.1) 0.1s both; }
        .pp-right-mobile { animation: fadeInUp 0.5s cubic-bezier(.22,.68,0,1.1) 0.15s both; }
        input::placeholder { color: #666; }
        input:focus { outline: none; }
        ::-webkit-scrollbar { width: 3px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CC000044; border-radius: 2px; }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div className="pp-left" style={{ flex: isMobile ? "0 0 auto" : "0 0 70%", height: isMobile ? 130 : "100%", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/*
          Particle canvas is desktop-only. The mobile auth strip is just
          130 px tall and is also the surface that ships inside the
          Google Play Store wrapper (TWA / Capacitor) — every battery-
          watt the particle loop burns there comes straight out of the
          user's first-launch experience. On mobile we fall back to the
          dark base + radial vignette + edge-fade, which still reads as
          intentional and keeps the logo + title as the focal point.
          The "Particle Settings" dev overlay is hidden for the same
          reason: there's nothing to configure when nothing is rendering.
        */}
        {!isMobile && <ParticleCanvas settings={particleSettings} />}
        <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "radial-gradient(ellipse at center, transparent 30%, rgba(3,3,3,0.7) 100%)", pointerEvents: "none" }} />
        {isMobile && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, zIndex: 2, background: "linear-gradient(to bottom, transparent, #0d0d0d)", pointerEvents: "none" }} />}
        {!isMobile && <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 120, zIndex: 2, background: "linear-gradient(to right, transparent, #0d0d0d)", pointerEvents: "none" }} />}
        {!isMobile && (
          <div style={{ position: "absolute", top: 12, right: 12, zIndex: 4 }}>
            <button
              type="button"
              onClick={() => setShowParticleControls(s => !s)}
              style={{ background: "rgba(10,10,10,0.85)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 8, color: "#fff", fontFamily: FONT, fontSize: 12, padding: "8px 10px", letterSpacing: "0.08em", cursor: "pointer" }}
            >
              Particle Settings
            </button>
            {showParticleControls && (
              <div style={{ marginTop: 8, width: 260, background: "rgba(8,8,8,0.95)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: 12, backdropFilter: "blur(3px)" }}>
                <div style={{ fontFamily: FONT, fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 4 }}>Count (100 - 500)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="range" min={100} max={500} step={10} value={particleSettings.count} onChange={e => updateParticleSetting("count", Number(e.target.value))} style={{ width: "100%" }} />
                      <span style={sliderValueStyle}>{particleSettings.count}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 4 }}>Connect (60 - 100)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="range" min={60} max={100} step={5} value={particleSettings.connect} onChange={e => updateParticleSetting("connect", Number(e.target.value))} style={{ width: "100%" }} />
                      <span style={sliderValueStyle}>{particleSettings.connect}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 4 }}>Attract Radius (40 - 150)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="range" min={40} max={150} step={5} value={particleSettings.attractRadius} onChange={e => updateParticleSetting("attractRadius", Number(e.target.value))} style={{ width: "100%" }} />
                      <span style={sliderValueStyle}>{particleSettings.attractRadius}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 4 }}>Attract Force (100 - 250)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="range" min={100} max={250} step={10} value={particleSettings.attractForce} onChange={e => updateParticleSetting("attractForce", Number(e.target.value))} style={{ width: "100%" }} />
                      <span style={sliderValueStyle}>{particleSettings.attractForce}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 4 }}>Max Speed (2 - 14)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="range" min={2} max={14} step={0.5} value={particleSettings.maxSpeed} onChange={e => updateParticleSetting("maxSpeed", Number(e.target.value))} style={{ width: "100%" }} />
                      <span style={sliderValueStyle}>{particleSettings.maxSpeed.toFixed(1)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setParticleSettings(DEFAULT_PARTICLE_SETTINGS)}
                    style={{ marginTop: 4, width: "100%", padding: "8px 10px", background: "transparent", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 7, color: "#bbb", fontFamily: FONT, fontSize: 12, letterSpacing: "0.06em", cursor: "pointer", textTransform: "uppercase" }}
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div
          style={{
            position: "relative",
            zIndex: 3,
            display: "flex",
            flexDirection: isMobile ? "row" : "column",
            alignItems: "center",
            gap: isMobile ? 12 : 28,
            userSelect: "none",
            padding: isMobile ? "0 16px" : 0,
            width: isMobile ? "100%" : "auto",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          <img src="/Pentaprotocol_Logo_Transparent.png" alt="PentaProtocol Logo" style={{ width: isMobile ? 44 : 220, height: isMobile ? 44 : 220, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 0 32px rgba(255,100,30,0.55)) drop-shadow(0 0 80px rgba(200,60,0,0.3))" }} />
          <div
            style={{
              textAlign: isMobile ? "left" : "center",
              // On mobile the title sits in a flex row next to the logo.
              // Without ``min-width: 0`` the text block refuses to shrink
              // below its intrinsic inline width, so "PENTAPROTOCOL" spills
              // past the right edge and the visual shows only "PENTA…".
              // Allowing the flex child to shrink + letting the gradient
              // spans be inline-block with word-break lets the title stay
              // fully visible on narrow phones.
              minWidth: 0,
              flex: isMobile ? "1 1 0" : "0 0 auto",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                // clamp() keeps the title readable on very small phones
                // (320px viewports) without touching the desktop 42px.
                fontSize: isMobile ? "clamp(15px, 4.6vw, 20px)" : 42,
                fontWeight: 900,
                letterSpacing: isMobile ? "0.06em" : "0.22em",
                lineHeight: 1.05,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "clip",
              }}
            >
              <span style={{ background: "linear-gradient(to bottom, #ffffff 0%, #999999 50%, #ffffff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))", display: "inline" }}>PENTA</span>
              <span style={{ background: "linear-gradient(to bottom, #FF2200 0%, #8B0000 45%, #FF1100 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 12px rgba(255,30,0,0.7))", display: "inline" }}>PROTOCOL</span>
            </div>
            {!isMobile && (
              <div style={{ display: "flex", gap: 5, marginTop: 12, alignItems: "center", justifyContent: "center" }}>
                {["AI", "RANKED", "SOLO"].map((tag, i) => (
                  <React.Fragment key={tag}>
                    {i > 0 && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>·</span>}
                    <div style={{ fontFamily: "'Times New Roman', serif", fontSize: 20, letterSpacing: "0.2em", color: "#ffffff", textTransform: "uppercase", fontWeight: 700 }}>{tag}</div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
        {!isMobile && <div style={{ position: "absolute", bottom: 22, left: 28, zIndex: 3, fontFamily: "'Courier New', monospace", fontSize: 10, color: "#2a2a2a", letterSpacing: "0.15em" }}>v1.0 · PROTOCOL ACTIVE</div>}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className={isMobile ? "pp-right-mobile" : "pp-right"}
        style={{ flex: isMobile ? "1 1 auto" : "0 0 30%", background: "#0d0d0d", borderLeft: isMobile ? "none" : "1px solid rgba(204,0,0,0.12)", borderTop: isMobile ? "1px solid rgba(204,0,0,0.12)" : "none", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: isMobile ? "flex-start" : "center", padding: isMobile ? "15px 15px 24px" : "32px 32px", overflowY: "auto", position: "relative" }}
      >
        <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: isMobile ? 12 : 18, color: "#ffffff", letterSpacing: isMobile ? "0.12em" : "0.22em", textTransform: "uppercase", marginBottom: isMobile ? 12 : 24, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.3)" }} />
          <span>AUTHENTICATION PORTAL</span>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.3)" }} />
        </div>

        {audio && (
          <div
            style={{
              marginBottom: isMobile ? 14 : 18,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
              <span style={{ ...labelStyle, marginBottom: 0, letterSpacing: "0.14em" }}>Music volume</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ ...sliderValueStyle, minWidth: 40, color: audio.muted ? "#777" : "#ddd" }}>
                  {audio.muted ? "—" : `${Math.round(audio.musicVol * 100)}%`}
                </span>
                <button
                  type="button"
                  onClick={() => audio.toggleMute()}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${audio.muted ? ACCENT : "rgba(255,255,255,0.2)"}`,
                    borderRadius: 6,
                    color: audio.muted ? ACCENT2 : "#aaa",
                    fontFamily: FONT,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {audio.muted ? "Unmute" : "Mute"}
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={audio.musicVol}
              disabled={audio.muted}
              onChange={(e) => audio.setMusicVol(parseFloat(e.target.value))}
              style={{
                width: "100%",
                accentColor: ACCENT,
                opacity: audio.muted ? 0.38 : 1,
                cursor: audio.muted ? "not-allowed" : "pointer",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontFamily: FONT, fontSize: 10, color: "#555", letterSpacing: "0.06em" }}>0%</span>
              <span style={{ fontFamily: FONT, fontSize: 10, color: "#555", letterSpacing: "0.06em" }}>100%</span>
            </div>
          </div>
        )}

        {(tab === "signin" || tab === "signup") && (
          <div style={{ display: "flex", marginBottom: isMobile ? 12 : 24, border: "1px solid rgba(255,255,255,0.28)", borderRadius: 8, overflow: "hidden", background: "#1c1c1c" }}>
            {(["signin", "signup"] as const).map(tb => (
              <button key={tb} onClick={() => { setTab(tb); setErrors({}); setSuccessMsg(""); setShowPassword(false); setShowConfirm(false); }}
                style={{ flex: 1, padding: isMobile ? "13px" : "10px", background: tab === tb ? "#2e2e2e" : "transparent", border: "none", borderRight: tb === "signin" ? "1px solid rgba(255,255,255,0.15)" : "none", color: tab === tb ? "#ffffff" : "#888", fontFamily: FONT, fontSize: isMobile ? 14 : 13, fontWeight: tab === tb ? 700 : 400, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.18s" }}>
                {tb === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>
        )}

        {(tab === "forgot" || tab === "verify_code") && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", marginBottom: 6 }}>{tab === "forgot" ? "RESET PASSWORD" : "VERIFY CODE"}</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#FFF", lineHeight: 1.6 }}>{tab === "forgot" ? "Enter your email to receive a 6-digit reset code." : `Code sent to ${forgotEmail}. Enter it below.`}</div>
          </div>
        )}

        {tab === "verify_signup" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", marginBottom: 6 }}>VERIFY EMAIL</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#fff", lineHeight: 1.6 }}>A 6-digit code has been sent to <span style={{ color: ACCENT }}>{email}</span>. Enter it below to complete signup.</div>
          </div>
        )}

        {tab === "2fa_check" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", marginBottom: 6 }}>TWO-FACTOR AUTH</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>Enter the 6-digit code from your authenticator app.</div>
          </div>
        )}

        {tab === "merge_consent" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", marginBottom: 6 }}>ACCOUNT MERGE</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>An account with this email already exists.</div>
          </div>
        )}

        {successMsg && (
          <div style={{ background: "rgba(0,200,80,0.08)", border: "1px solid rgba(0,200,80,0.3)", borderRadius: 7, padding: "10px 13px", marginBottom: 14, fontFamily: FONT, fontSize: 12, color: "#00c850", lineHeight: 1.5 }}>✓ {successMsg}</div>
        )}
        {errors.general && (
          <div style={{ background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.3)", borderRadius: 7, padding: "10px 13px", marginBottom: 14, fontFamily: FONT, fontSize: 12, color: ACCENT2, lineHeight: 1.5 }}>⚠ {errors.general}</div>
        )}

        <div className={shake ? "pp-auth-shake" : ""}>

          {tab === "signin" && (<>
            {field("username", "Username / Email", username, setUsername, errors.username || "", "Enter username or email")}
            {passwordField("password", "Password", password, setPassword, errors.password || "", "Enter password", showPassword, setShowPassword)}
            <Checkbox checked={staySignedIn} onToggle={() => setStaySignedIn(s => !s)} label="Stay signed in for 30 days" />
            <PrimaryBtn label={loading ? "Signing in…" : "Sign In"} onClick={submit} disabled={loading} />
            {GOOGLE_CLIENT_ID && (<>
              <OrDivider />
              <GoogleBtn label="Continue with Google" />
            </>)}
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={() => { setTab("forgot"); setErrors({}); setSuccessMsg(""); }}
                style={{ background: "none", border: "none", color: "#999", fontFamily: FONT, fontSize: 14.7, cursor: "pointer", letterSpacing: "0.05em", textDecoration: "underline", textDecorationColor: "#777", fontStyle: "italic" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = ACCENT}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#999"}
              >Forgot password?</button>
            </div>
          </>)}

          {tab === "signup" && (<>
            {field("username", "Username", username, setUsername, errors.username || "", "3–12 chars, no special chars")}
            {field("email", "Email", email, setEmail, errors.email || "", "you@example.com")}
            {passwordField("password", "Password", password, setPassword, errors.password || "", "Min 6 characters", showPassword, setShowPassword)}
            {passwordField("confirm", "Confirm Password", confirm, setConfirm, errors.confirm || "", "Re-enter password", showConfirm, setShowConfirm)}
            <div style={{ marginBottom: isMobile ? 10 : 14 }}>
              <label style={labelStyle}>Date of Birth</label>
              <input type="date" value={(errors as any)._dob_value ?? ""}
                onChange={e => { const val = e.target.value; setErrors(er => ({ ...er, dob: "", _dob_value: val } as any)); }}
                onKeyDown={handleKeyDown}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split("T")[0]}
                style={{ ...inputStyle(!!errors.dob), colorScheme: "dark" }}
                onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
                onBlur={e => { e.target.style.borderColor = errors.dob ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
              />
              <div style={{ fontFamily: FONT, fontSize: 11, color: "#555", marginTop: 4 }}>You must be at least 13 years old to use PentaProtocol</div>
              {errors.dob && <div style={errorStyle}>{errors.dob}</div>}
            </div>
            <PrimaryBtn label={loading ? "Sending OTP…" : "Continue"} onClick={submit} disabled={loading} />
            {GOOGLE_CLIENT_ID && (<>
              <OrDivider text="or sign up instantly" />
              <GoogleBtn label="Sign Up with Google" />
            </>)}
          </>)}

          {tab === "verify_signup" && (<>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>6-Digit Code</label>
              <input type="text" value={signupOtp} maxLength={6} autoFocus
                onChange={e => { setSignupOtp(e.target.value.replace(/\D/g, "")); setErrors(er => ({ ...er, signupOtp: "" })); }}
                onKeyDown={handleKeyDown} placeholder="482916"
                style={{ ...inputStyle(!!errors.signupOtp), textAlign: "center", fontSize: 22, letterSpacing: "0.35em", fontFamily: "'Courier New', monospace" }}
                onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
                onBlur={e  => { e.target.style.borderColor = errors.signupOtp ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
              />
              {errors.signupOtp && <div style={errorStyle}>{errors.signupOtp}</div>}
            </div>
            <PrimaryBtn label={loading ? "Verifying…" : "Verify & Create Account"} onClick={submitSignupOtp} disabled={loading} />
            <GhostBtn label="← Resend Code" onClick={async () => { setLoading(true); try { await API.post("/api/otp/signup/send", { email }); setSuccessMsg("New code sent!"); } catch {} finally { setLoading(false); } }} />
            <GhostBtn label="← Back to Sign Up" onClick={() => { setTab("signup"); setSignupOtp(""); setErrors({}); setSuccessMsg(""); }} />
          </>)}

          {tab === "forgot" && (<>
            {field("forgotEmail", "Email Address", forgotEmail, setForgotEmail, errors.forgotEmail || "", "you@example.com")}
            <PrimaryBtn label={loading ? "Sending…" : "Send Reset Code"} onClick={submitForgot} disabled={loading} />
            <GhostBtn label="← Back to Sign In" onClick={() => { setTab("signin"); setErrors({}); setSuccessMsg(""); }} />
          </>)}

          {tab === "verify_code" && (<>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>6-Digit Code</label>
              <input type="text" value={resetCode} maxLength={6}
                onChange={e => { setResetCode(e.target.value.replace(/\D/g, "")); setErrors(er => ({ ...er, resetCode: "" })); }}
                onKeyDown={handleKeyDown} placeholder="482916"
                style={{ ...inputStyle(!!errors.resetCode), textAlign: "center", fontSize: 22, letterSpacing: "0.35em", fontFamily: "'Courier New', monospace" }}
                onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
                onBlur={e  => { e.target.style.borderColor = errors.resetCode ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
              />
              {errors.resetCode && <div style={errorStyle}>{errors.resetCode}</div>}
            </div>
            {field("newPassword", "New Password", newPassword, setNewPassword, errors.newPassword || "", "Min 6 characters", "password")}
            {field("newConfirm", "Confirm New Password", newConfirm, setNewConfirm, errors.newConfirm || "", "Re-enter new password", "password")}
            <PrimaryBtn label={loading ? "Resetting…" : "Reset Password"} onClick={submitReset} disabled={loading} />
            <GhostBtn label="← Resend Code" onClick={() => setTab("forgot")} />
          </>)}

          {tab === "2fa_check" && (<>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Authenticator Code</label>
              <input type="text" value={totpCode} maxLength={6} autoFocus
                onChange={e => { setTotpCode(e.target.value.replace(/\D/g, "")); setErrors(er => ({ ...er, totpCode: "" })); }}
                onKeyDown={handleKeyDown} placeholder="000000"
                style={{ ...inputStyle(!!errors.totpCode), textAlign: "center", fontSize: 26, letterSpacing: "0.4em", fontFamily: "'Courier New', monospace" }}
                onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
                onBlur={e  => { e.target.style.borderColor = errors.totpCode ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
              />
              {errors.totpCode && <div style={errorStyle}>{errors.totpCode}</div>}
            </div>
            <PrimaryBtn label={loading ? "Verifying…" : "Verify"} onClick={submit2FA} disabled={loading} />
            <GhostBtn label="← Back to Sign In" onClick={() => { setTab("signin"); setTempToken(""); setTotpCode(""); setErrors({}); }} />
          </>)}

          {tab === "merge_consent" && (<>
            <div style={{ fontFamily: FONT, fontSize: 14, color: "#fff", lineHeight: 1.6, marginBottom: 24, textAlign: "justify", background: "rgba(204,0,0,0.05)", padding: 14, borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              Do you want to link your Google account to your existing PentaProtocol account? Creating two different accounts with the same email is not possible.
            </div>
            <PrimaryBtn label={loading ? "Merging…" : "Merge & Sign In"} onClick={submitMergeConsent} disabled={loading} />
            <GhostBtn label="Cancel" onClick={() => { setTab("signin"); setPendingGoogleCred(""); setErrors({}); }} />
          </>)}

        </div>

        <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.15)" }} />
          <div style={{ fontFamily: FONT, fontSize: isMobile ? 14 : 20, fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.15em", lineHeight: 1 }}>PENTAPROTOCOL</div>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.15)" }} />
        </div>
      </div>
    </div>
  );
}