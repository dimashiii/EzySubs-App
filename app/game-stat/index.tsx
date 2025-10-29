// app/game-stat/index.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle } from "react-native-svg";
import { loadJSON } from "../../lib/storage";

// ────────────────────────
// TYPES
// ────────────────────────
type SavedPlayerSnapshot = {
  id: string;
  name: string;
  seconds: number;
  subs: number;
};

type SavedGameSnapshot = {
  id: string;
  practiceDate: string;
  startedAt: number;
  endedAt: number;
  totalGameSeconds: number;
  players: SavedPlayerSnapshot[];
};

const STORAGE_KEY = "gameHistory";
const LIVE_PREVIEW_KEY = "liveGamePreview";

const THEME = {
  background: "#F4F7FF",
  card: "#FFFFFF",
  border: "rgba(37,99,235,0.18)",
  text: "#0F172A",
  muted: "#475569",
  accent: "#2563EB",
  accentMuted: "rgba(37,99,235,0.12)",
  ringTrack: "#DBEAFE",
  ringBackground: "#EFF6FF",
};

function pad(value: number) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatPracticeDate(raw: string) {
  const date = new Date(`${raw}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatGameTimeRange(start: number, end: number) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const startLabel = startDate.toLocaleTimeString(undefined, options);
  const endLabel = endDate.toLocaleTimeString(undefined, options);
  return sameDay ? `${startLabel} – ${endLabel}` : `${startLabel} → ${endLabel}`;
}

// ────────────────────────
// RING COMPONENT (time on court)
// ────────────────────────
function TimeRing({
  valueText,
  progress,
  size = 52,
  strokeWidth = 5,
  ringColor = THEME.accent,
  trackColor = THEME.ringTrack,
  bgColor = THEME.ringBackground,
}: {
  valueText: string;
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  ringColor?: string;
  trackColor?: string;
  bgColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <View
      style={[
        styles.ringWrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* base ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      <Text style={styles.ringText}>{valueText}</Text>
    </View>
  );
}

// ────────────────────────
// MAIN SCREEN
// ────────────────────────
export default function GameStatsScreen() {
  const { gameId: rawGameId, live: rawLive } =
    useLocalSearchParams<{ gameId?: string; live?: string }>();
  const requestedGameId = Array.isArray(rawGameId)
    ? rawGameId[0]
    : rawGameId ?? null;
  const isLiveView =
    rawLive === "1" ||
    rawLive === "true" ||
    (Array.isArray(rawLive) && rawLive[0] === "1");

  const [games, setGames] = useState<SavedGameSnapshot[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(
    requestedGameId
  );
  const [liveGame, setLiveGame] = useState<SavedGameSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    const history = await loadJSON<SavedGameSnapshot[]>(STORAGE_KEY, []);
    history.sort((a, b) => b.endedAt - a.endedAt);
    setGames(history);
    if (history.length === 0) {
      setSelectedGameId(null);
      return;
    }
    if (isLiveView) {
      return;
    }
    setSelectedGameId((prev) => {
      if (
        requestedGameId &&
        history.some((game) => game.id === requestedGameId)
      ) {
        return requestedGameId;
      }
      if (prev && history.some((game) => game.id === prev)) {
        return prev;
      }
      return history[0].id;
    });
  }, [requestedGameId, isLiveView]);

  const loadLiveSnapshot = useCallback(async () => {
    if (!isLiveView) {
      setLiveGame(null);
      return;
    }
    const snapshot = await loadJSON<SavedGameSnapshot | null>(
      LIVE_PREVIEW_KEY,
      null
    );
    setLiveGame(snapshot);
  }, [isLiveView]);

  useFocusEffect(
    useCallback(() => {
      loadGames();
      void loadLiveSnapshot();
    }, [loadGames, loadLiveSnapshot])
  );

  useEffect(() => {
    if (!requestedGameId || isLiveView) return;
    const exists = games.some((game) => game.id === requestedGameId);
    if (exists) {
      setSelectedGameId(requestedGameId);
    }
  }, [requestedGameId, games, isLiveView]);

  useEffect(() => {
    if (isLiveView) {
      setSelectedGameId(null);
    }
  }, [isLiveView]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGames();
    await loadLiveSnapshot();
    setRefreshing(false);
  }, [loadGames, loadLiveSnapshot]);

  const selectedGame = useMemo(() => {
    if (isLiveView && liveGame) {
      return liveGame;
    }
    if (games.length === 0) return null;
    if (selectedGameId) {
      const match = games.find((g) => g.id === selectedGameId);
      if (match) return match;
    }
    return games[0] ?? null;
  }, [games, selectedGameId, isLiveView, liveGame]);

  const playersForSelected = useMemo(() => {
    if (!selectedGame) return [];
    const maxSeconds = Math.max(
      ...selectedGame.players.map((p) => p.seconds ?? 0),
      1
    );
    return selectedGame.players
      .slice()
      .sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0))
      .map((player) => ({
        ...player,
        timeLabel: formatSeconds(player.seconds ?? 0),
        progress: Math.min((player.seconds ?? 0) / maxSeconds, 1),
      }));
  }, [selectedGame]);

  const renderPlayerRow = ({
    item,
  }: {
    item: SavedPlayerSnapshot & { timeLabel: string; progress: number };
  }) => {
    return (
      <View style={styles.playerRow}>
        {/* PLAYER NAME ONLY (no avatar) */}
        <View style={styles.playerLeft}>
          <Text style={styles.playerName}>{item.name}</Text>
        </View>

        {/* MIN ON COURT */}
        <View style={styles.timeWrap}>
          <TimeRing
            valueText={item.timeLabel}
            progress={item.progress}
            ringColor={THEME.accent}
            trackColor={THEME.ringTrack}
            bgColor={THEME.ringBackground}
          />
        </View>

        {/* SUB COUNT */}
        <View style={styles.subWrap}>
          <Text style={styles.subCount}>{item.subs}</Text>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* hide expo-router's default header */}
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        {/* HEADER BAR */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.headerIconBtn}
          >
            <Ionicons name="chevron-back" size={20} color={THEME.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Game stats</Text>

          <Pressable
            onPress={() => router.push("/team-statistic")}
            hitSlop={10}
            style={styles.headerIconBtn}
          >
            <Ionicons name="stats-chart" size={20} color={THEME.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {selectedGame ? (
            <>
              <View style={styles.selectedMeta}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={THEME.muted}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedMetaTitle}>
                  {formatPracticeDate(selectedGame.practiceDate)}
                </Text>
                <Text style={styles.selectedMetaSubtitle}>
                  {formatGameTimeRange(
                    selectedGame.startedAt,
                    selectedGame.endedAt
                  )}
                </Text>
              </View>
              {selectedGame.id === "live" ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveBadgeDot} />
                  <Text style={styles.liveBadgeText}>Live session</Text>
                </View>
              ) : null}
            </View>

              <View style={styles.cardWrapper}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Game summary</Text>

                  <View style={styles.summaryRow}>
                    <View style={styles.summaryBlock}>
                      <Text style={styles.summaryLabel}>Practice date</Text>
                      <Text style={styles.summaryValue}>
                        {formatPracticeDate(selectedGame.practiceDate)}
                      </Text>
                    </View>
                    <View style={styles.summaryBlock}>
                      <Text style={styles.summaryLabel}>Duration</Text>
                      <Text style={styles.summaryValue}>
                        {formatSeconds(
                          Math.round(selectedGame.totalGameSeconds)
                        )}
                      </Text>
                    </View>
                    <View style={styles.summaryBlock}>
                      <Text style={styles.summaryLabel}>Session time</Text>
                      <Text style={styles.summaryValue}>
                        {formatGameTimeRange(
                          selectedGame.startedAt,
                          selectedGame.endedAt
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tableHeadRow}>
                    <Text style={[styles.tableHeadText, { flex: 1 }]}>
                      Player
                    </Text>

                    <Text
                      style={[
                        styles.tableHeadText,
                        {
                          width: 90,
                          textAlign: "center",
                        },
                      ]}
                    >
                      Min on Court
                    </Text>

                    <Text
                      style={[
                        styles.tableHeadText,
                        {
                          width: 90,
                          textAlign: "center",
                        },
                      ]}
                    >
                      Substitutions
                    </Text>
                  </View>

                  <View style={styles.headDivider} />

                  {playersForSelected.length === 0 ? (
                    <View style={styles.emptyPlayers}>
                      <Text style={styles.emptyPlayersText}>
                        No player stats recorded for this game yet.
                      </Text>
                    </View>
                  ) : (
                    playersForSelected.map((player) => (
                      <React.Fragment key={player.id}>
                        {renderPlayerRow({ item: player })}
                      </React.Fragment>
                    ))
                  )}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.cardWrapper}>
              <View style={styles.emptyCard}>
                <Ionicons
                  name="clipboard-outline"
                  size={24}
                  color={THEME.accent}
                  style={{ marginBottom: 8 }}
                />
                <Text style={styles.emptyCardTitle}>Select a game</Text>
                <Text style={styles.emptyCardText}>
                  Head to team history to pick a game and review player minutes.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.homeIndicatorBar} />
      </SafeAreaView>
    </>
  );
}

// ────────────────────────
// STYLES
// ────────────────────────
const styles = StyleSheet.create({
  /************************
   * PAGE LAYOUT
   ************************/
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.select({ ios: 8, android: 16 }),
    backgroundColor: THEME.background,
  },
  bodyContent: {
    paddingBottom: 48,
  },

  /************************
   * HEADER
   ************************/
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.accentMuted,
    shadowColor: "rgba(37,99,235,0.35)",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
  },

  selectedMeta: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: THEME.card,
    shadowColor: "rgba(37,99,235,0.25)",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginTop: 4,
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "rgba(220,38,38,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DC2626",
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },
  selectedMetaTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: THEME.text,
  },
  selectedMetaSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: THEME.accent,
  },
  emptyCard: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: "center",
    backgroundColor: THEME.card,
    shadowColor: "rgba(15,23,42,0.2)",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.text,
  },
  emptyCardText: {
    marginTop: 6,
    fontSize: 13,
    color: THEME.muted,
    textAlign: "center",
  },

  /************************
   * CARD
   ************************/
  cardWrapper: {
    width: "100%",
    marginTop: 20,
  },
  card: {
    width: "100%",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: THEME.card,
    shadowColor: "rgba(37,99,235,0.25)",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: {
    textAlign: "center",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    color: THEME.accent,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  summaryBlock: {
    flexBasis: "30%",
    flexGrow: 1,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: THEME.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
    color: THEME.text,
  },

  /************************
   * TABLE HEAD
   ************************/
  tableHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tableHeadText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: 0.25,
    color: THEME.accent,
  },
  headDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.divider,
    marginBottom: 8,
  },
  emptyPlayers: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyPlayersText: {
    fontSize: 13,
    color: THEME.muted,
  },

  /************************
   * PLAYER ROW
   ************************/
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  playerLeft: {
    flex: 1,
    justifyContent: "center",
  },
  playerName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: THEME.text,
  },

  timeWrap: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
  },

  subWrap: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
  },

  subCount: {
    fontSize: 32,
    lineHeight: 32,
    fontWeight: "700",
    color: THEME.accent,
  },

  /************************
   * TIME RING
   ************************/
  ringWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  ringText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.accent,
  },

  /************************
   * HOME INDICATOR STRIP
   ************************/
  homeIndicatorBar: {
    position: "absolute",
    left: "25%",
    right: "25%",
    bottom: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(15,23,42,0.15)",
  },
});
