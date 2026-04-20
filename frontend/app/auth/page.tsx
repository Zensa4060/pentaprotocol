"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/components/AppShell";
import AuthScreen from "@/components/AuthScreen";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import {
  POLICY_GATE_SESSION_KEY,
  getUserId,
  hasAcceptedLegal,
} from "@/lib/legalAcceptance";

export default function AuthPage() {
  const { token, appReady, navigate, themeId } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!appReady || !token || pathname !== "/auth") return;
    const uid = getUserId(user);
    if (!uid) {
      router.replace("/home");
      return;
    }
    try {
      const pending = sessionStorage.getItem(POLICY_GATE_SESSION_KEY);
      if (pending === uid && !hasAcceptedLegal(uid, user)) return;
    } catch {
      /* sessionStorage blocked */
    }
    router.replace("/home");
  }, [appReady, token, router, pathname, user]);

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
