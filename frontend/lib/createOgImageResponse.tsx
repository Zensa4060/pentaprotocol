import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const ogImageAlt =
  "PentaProtocol — welcome to the 5×5 ranked strategy game with matchmaking and seasons.";

export const ogImageSize = { width: 1200, height: 630 };

export const ogImageContentType = "image/png";

export async function createOgImageResponse() {
  const logoPath = join(process.cwd(), "public", "Pentaprotocol_Logo_Transparent.png");
  const logoBuffer = await readFile(logoPath);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "48px 56px",
          background:
            "radial-gradient(ellipse 130% 120% at 15% 0%, #241018 0%, #0a0608 42%, #020204 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-100px",
            top: "-100px",
            width: "440px",
            height: "440px",
            background: "radial-gradient(circle, rgba(204,0,0,0.38) 0%, transparent 68%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "35%",
            bottom: "-140px",
            width: "520px",
            height: "520px",
            background: "radial-gradient(circle, rgba(140,30,70,0.22) 0%, transparent 62%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.12,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 640,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.52)",
            }}
          >
            Welcome to
          </div>
          <div
            style={{
              fontSize: 70,
              fontWeight: 800,
              lineHeight: 1.05,
              color: "#f5f5f5",
              letterSpacing: "-0.02em",
              textShadow:
                "0 0 48px rgba(204,0,0,0.5), 0 0 24px rgba(204,0,0,0.35), 0 6px 28px rgba(0,0,0,0.85)",
            }}
          >
            PentaProtocol
          </div>
          <div
            style={{
              fontSize: 27,
              lineHeight: 1.45,
              color: "rgba(235,235,235,0.9)",
              maxWidth: 520,
            }}
          >
            5×5 ranked strategy — matchmaking, seasons, and competitive play. Step into the grid.
          </div>
          <div
            style={{
              marginTop: 10,
              height: 4,
              width: 168,
              borderRadius: 2,
              background: "linear-gradient(90deg, #CC0000, #ff5a5a, rgba(255,90,90,0))",
              boxShadow: "0 0 22px rgba(204,0,0,0.85)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 12,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og Satori output */}
          <img
            src={logoSrc}
            height={300}
            width={300}
            alt=""
            style={{
              objectFit: "contain",
              boxShadow: "0 0 60px rgba(204,0,0,0.45), 0 0 120px rgba(80,20,40,0.35)",
            }}
          />
        </div>
      </div>
    ),
    { ...ogImageSize }
  );
}
