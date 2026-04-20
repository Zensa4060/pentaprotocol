"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppShell";
import AuthScreen from "@/components/AuthScreen";

/**
 * Root `/` — shows auth screen when not logged in; redirects to /home when authenticated.
 */
export default function RootPage() {
  const { token, appReady, navigate, themeId } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (appReady && token) router.replace("/home");
  }, [appReady, token, router]);

  if (!appReady) return null;
  if (token) return null;

  return <AuthScreen setScreenAction={navigate} themeId={themeId} />;
}
