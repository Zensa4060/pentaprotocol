"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./AppShell";

/**
 * Wrap a page component to redirect unauthenticated visitors to /auth.
 * Renders children only when a session is present. Guest mode was
 * removed, so this is now the standard gate for any route that is
 * reached outside of AppShell's global auth gate (e.g. pages that
 * render before the shell is fully mounted).
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
