"use client";

import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import SyrosChat from "@/components/SyrosChat";

export default function SyrosPage() {
  const { themeId } = useApp();
  return (
    <AuthGuard>
      <SyrosChat themeId={themeId} />
    </AuthGuard>
  );
}
