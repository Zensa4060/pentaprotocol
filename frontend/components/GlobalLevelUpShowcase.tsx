"use client";
import React from "react";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import XpLevelUpScreen from "./XpLevelUpScreen";

interface Props {
  themeId: ThemeId;
}

export default function GlobalLevelUpShowcase({ themeId }: Props) {
  const { pendingLevelUp, setPendingLevelUp } = useAuthStore();
  const t = THEMES[themeId];

  if (!pendingLevelUp) return null;

  return (
    <XpLevelUpScreen
      fromLevel={pendingLevelUp.from}
      toLevel={pendingLevelUp.to}
      onDone={() => setPendingLevelUp(null)}
      t={t}
    />
  );
}
