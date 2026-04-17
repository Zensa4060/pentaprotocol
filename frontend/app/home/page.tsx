"use client";
import { useApp } from "@/components/AppShell";
import HomeScreen from "@/components/HomeScreen";

export default function HomePage() {
  const { navigate, themeId, sfx, homeNotice } = useApp();
  return (
    <HomeScreen
      setScreenAction={navigate}
      themeId={themeId}
      onHoverAction={sfx.hover}
      onClickAction={sfx.click}
      homeNotice={homeNotice}
    />
  );
}
