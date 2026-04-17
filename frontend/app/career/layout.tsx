"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import CareerScreen from "@/components/CareerScreen";

export default function CareerLayout({ children }: { children: React.ReactNode }) {
  const { themeId, sfx } = useApp();
  const pathname = usePathname();

  const initialMatchId = useMemo(() => {
    if (!pathname) return undefined;
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "career" || parts.length < 2) return undefined;
    return parts[1] || undefined;
  }, [pathname]);

  return (
    <AuthGuard>
      <CareerScreen
        themeId={themeId}
        onHoverAction={sfx.hover}
        initialMatchId={initialMatchId}
      />
      {children}
    </AuthGuard>
  );
}
