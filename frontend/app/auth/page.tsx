"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppShell";
import AuthScreen from "@/components/AuthScreen";

export default function AuthPage() {
  const { token, appReady, navigate, themeId } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (appReady && token) router.replace("/home");
  }, [appReady, token, router]);

  if (!appReady) return null;
  if (token) return null;

  return <AuthScreen setScreenAction={navigate} themeId={themeId} />;
}
