"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppShell";
import AuthScreen from "@/components/AuthScreen";
import { useAuthStore } from "@/lib/store";

export default function AuthPage() {
  const { token, appReady, navigate, themeId, audio } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  // Resolve the post-login destination from the `next` query param.
  // Never allow `next` to point back into /auth (open-redirect / loop guard).
  const nextRaw = searchParams?.get("next") || "";
  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("/auth") ? nextRaw : "/home";

  // Navigate away from /auth the moment we have a token.
  //
  // Important: we deliberately do NOT stall here waiting for the policy
  // gate. The PolicyAcceptanceGate is a global overlay mounted in
  // AppShell that renders on top of /home too, so it's safe — and much
  // more reliable — to bounce to the destination route and let the
  // overlay layer handle itself. Stalling on /auth risks leaving the
  // user on a blank page if the gate state ever flickers or if the
  // redirect effect doesn't re-fire on subsequent renders.
  const redirectedRef = useRef(false);
  useLayoutEffect(() => {
    if (redirectedRef.current) return;
    if (!appReady || !token) return;
    const isAuthEntry = pathname === "/auth" || pathname === "/";
    if (!isAuthEntry) return;
    redirectedRef.current = true;
    router.replace(nextPath);
  }, [appReady, token, pathname, nextPath, router]);

  // Safety net: if the client router fails to navigate off /auth within
  // a short window (observed during edge cases where policy-gate state
  // or suspense boundaries stalled the push), fall back to a full
  // location replace so the user is never stuck on a blank screen.
  useEffect(() => {
    if (!appReady || !token) return;
    const isAuthEntry = pathname === "/auth" || pathname === "/";
    if (!isAuthEntry) return;
    const id = window.setTimeout(() => {
      if (
        typeof window !== "undefined" &&
        (window.location.pathname === "/auth" || window.location.pathname === "/")
      ) {
        try {
          window.location.replace(nextPath);
        } catch {
          /* noop */
        }
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [appReady, token, pathname, nextPath]);

  if (!appReady) return null;
  // When a token is present we're mid-redirect. Render nothing (not a
  // coloured full-screen div) so the route transition is seamless and
  // the previous content stays painted until /home mounts.
  if (token) return null;

  return <AuthScreen setScreenAction={navigate} themeId={themeId} audio={audio} />;
}
