/**
 * Match-found VS splash — mobile parity with web LobbyScreen matchup phase.
 */

import { Image, StyleSheet, Text, View } from "react-native";

import { BannerRenderer } from "@/components/BannerRenderer";
import { Caption, Eyebrow, Heading, Title } from "@/components/ui";
import { colors, radii, space } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";

const RANKED_GOLD = "#D4AF37";

export interface MatchFoundPlayer {
  name: string;
  level: number;
  elo: number | null;
  placementMatches?: number;
  avatar?: string | null;
  avatarEmoji?: string | null;
  banner?: string;
  tierLabel?: string;
  tierColor?: string;
  isBot?: boolean;
  isSyros?: boolean;
}

interface MatchFoundVsProps {
  format: "ranked" | "unranked";
  me: MatchFoundPlayer;
  opponent: MatchFoundPlayer;
}

export function MatchFoundVs({ format, me, opponent }: MatchFoundVsProps) {
  const { themeId } = useTheme();
  const isRanked = format === "ranked";
  const isSyros = opponent.isSyros;
  const accent = isSyros ? "#C084FC" : isRanked ? RANKED_GOLD : colors.accent;
  const header = isSyros
    ? "SYROS · THE GAME BENEATH THE GAME"
    : isRanked
      ? "RANKED · FIRST TO 5 POINTS"
      : "UNRANKED · FIRST TO 5 POINTS";

  const showElo = (p: MatchFoundPlayer) =>
    isRanked && p.placementMatches !== undefined
      ? (p.placementMatches ?? 5) >= 5 && p.elo != null
      : false;

  return (
    <View style={styles.root}>
      <View style={styles.bannerLeft}>
        <BannerRenderer bannerId={me.banner} themeId={themeId} style={StyleSheet.absoluteFill} overlayOpacity={0.55} />
      </View>
      <View style={styles.bannerRight}>
        <BannerRenderer
          bannerId={opponent.banner}
          themeId={themeId}
          style={StyleSheet.absoluteFill}
          overlayOpacity={0.55}
        />
      </View>

      <Eyebrow
        tone={isRanked ? "warn" : "accent"}
        style={{ ...styles.header, color: accent }}
      >
        {header}
      </Eyebrow>

      <View style={styles.row}>
        <PlayerCard player={me} accent={accent} ranked={isRanked} showElo={showElo(me)} side="left" />
        <View style={styles.vsWrap}>
          <Text style={[styles.vs, { color: accent, textShadowColor: accent }]}>VS</Text>
        </View>
        <PlayerCard
          player={opponent}
          accent={accent}
          ranked={isRanked}
          showElo={showElo(opponent)}
          side="right"
        />
      </View>
    </View>
  );
}

function PlayerCard({
  player,
  accent,
  ranked,
  showElo,
  side,
}: {
  player: MatchFoundPlayer;
  accent: string;
  ranked: boolean;
  showElo: boolean;
  side: "left" | "right";
}) {
  const tierColor = player.tierColor ?? accent;
  return (
    <View style={[styles.card, side === "left" ? styles.cardLeft : styles.cardRight]}>
      <View style={[styles.avatarRing, { borderColor: tierColor, shadowColor: tierColor }]}>
        {player.isSyros ? (
          <Image source={require("@/assets/images/syros-pfp.png")} style={styles.avatarImg} />
        ) : player.avatar ? (
          <Image source={{ uri: player.avatar }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarEmoji}>{player.avatarEmoji ?? "🎮"}</Text>
        )}
      </View>
      {player.tierLabel ? (
        <Caption style={{ color: tierColor, marginBottom: space[1] }}>{player.tierLabel}</Caption>
      ) : null}
      <Title style={styles.name}>{player.name}</Title>
      <Caption tone="muted">LEVEL {player.level}</Caption>
      {showElo && player.elo != null ? (
        <Heading style={{ marginTop: space[1], color: ranked ? RANKED_GOLD : colors.accent }}>
          {player.elo}
        </Heading>
      ) : ranked && !showElo ? (
        <Caption tone="muted" style={{ marginTop: space[1] }}>
          ELO ?
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#05060a",
    overflow: "hidden",
  },
  bannerLeft: {
    ...StyleSheet.absoluteFillObject,
    right: "50%",
    opacity: 0.35,
  },
  bannerRight: {
    ...StyleSheet.absoluteFillObject,
    left: "50%",
    opacity: 0.35,
  },
  header: {
    position: "absolute",
    top: space[8],
    left: 0,
    right: 0,
    textAlign: "center",
    letterSpacing: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[4],
    paddingTop: space[12],
    zIndex: 2,
  },
  vsWrap: {
    paddingHorizontal: space[2],
  },
  vs: {
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: 4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  card: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(8,10,18,0.82)",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingVertical: space[5],
    paddingHorizontal: space[3],
    minHeight: 200,
  },
  cardLeft: {
    marginRight: space[2],
  },
  cardRight: {
    marginLeft: space[2],
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[3],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 12,
    backgroundColor: colors.bgCard,
    overflow: "hidden",
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  name: {
    textAlign: "center",
    fontSize: 18,
    marginBottom: space[1],
  },
});
