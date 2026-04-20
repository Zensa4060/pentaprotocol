"use client";

import AuthGuard from "@/components/AuthGuard";
import FriendsScreen from "@/components/FriendsScreen";
import { useApp } from "@/components/AppShell";

export default function FriendsPage() {
  const { themeId, sfx } = useApp();
  return (
    <AuthGuard>
      <FriendsScreen themeId={themeId} onHoverAction={sfx.hover} />
    </AuthGuard>
  );
}
