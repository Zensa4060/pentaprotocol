"use client";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppShell";
import AuthScreen from "@/components/AuthScreen";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import {
  POLICY_GATE_SESSION_KEY,
  getUserId,
  hasAcceptedLegal,
} from "@/lib/legalAcceptance";

export default function LoginPage() {
  const { token, appReady, navigate, themeId } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!appReady || !token) return;
    if (pathname !== "/login") return;
    const uid = getUserId(user);
    const nextRaw = searchParams?.get("next") || "";
    const nextPath =
      nextRaw.startsWith("/") &&
      !nextRaw.startsWith("/auth") &&
      !nextRaw.startsWith("/login")
        ? nextRaw
        : "/home";
    if (!uid) {
      router.replace(nextPath);
      return;
    }
    try {
      const pending = sessionStorage.getItem(POLICY_GATE_SESSION_KEY);
      if (pending === uid && !hasAcceptedLegal(uid, user)) return;
    } catch {
      /* sessionStorage blocked */
    }
    router.replace(nextPath);
  }, [appReady, token, router, pathname, user, searchParams]);

  if (!appReady) return null;
  if (token) {
    const bg = THEMES[themeId]?.bg ?? "#0a0a0a";
    return (
      <div
        aria-hidden
        style={{ minHeight: "100vh", width: "100%", background: bg }}
      />
    );
  }

  return <AuthScreen setScreenAction={navigate} themeId={themeId} />;
}
