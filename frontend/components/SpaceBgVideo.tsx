// SpaceBgVideo.tsx
"use client";

export default function SpaceBgVideo() {
  return (
    <video
      autoPlay loop muted playsInline
      style={{
        position: "fixed", inset: 0,
        width: "100%", height: "100%",
        objectFit: "cover", objectPosition: "center",
        zIndex: 0, pointerEvents: "none",
      }}
    >
      <source src="/space-bg.mp4" type="video/mp4" />
    </video>
  );
}