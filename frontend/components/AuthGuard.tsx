"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./AppShell";

/**
 * Wrap a page component to redirect guests (no token) to /auth.
 * Renders children only when the user is authenticated.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, appReady } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (appReady && !token) router.replace("/auth");
  }, [appReady, token, router]);

  if (!appReady || !token) return null;
  return <>{children}</>;
}
