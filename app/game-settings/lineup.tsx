import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Stack, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadJSON, saveJSON } from "../../lib/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Enhanced device detection
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_WIDTH < 350;
const isShortDevice = SCREEN_HEIGHT < 700;
const isTablet = SCREEN_WIDTH >= 768;
const isLargeTablet = SCREEN_WIDTH >= 1024;

// Improved responsive scaling with better tablet support
const scale = (size: number) => {
  if (isLargeTablet) return size * 1.4;
  if (isTablet) return size * 1.2;
  const ratio = SCREEN_WIDTH / 375;
  const clamped = Math.max(0.85, Math.min(ratio, 1.15));
  return size * clamped;
};

const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

type Player = { id: string; name: string };
type StoredLineup = { starters: string[]; bench: string[] };

const KEYS = {
  players: "playersDB",
  selected: "selectedPlayers",
  lineup: "gameLineup",
};

const COLORS = {
  text: "#0F172A",
  textMuted: "#64748B",
  bg: "#FFFFFF",
  accent: "#2563EB",
  accentSoft: "rgba(37,99,235,0.12)",
  success: "#10B981",
  successSoft: "rgba(16,185,129,0.12)",
  warning: "#F59E0B",
  danger: "#EF4444",
  divider: "rgba(15,23,42,0.06)",
};

export default function LineupScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning" | "info";
  } | null>(null);
  const toastY = useState(new Animated.Value(80))[0];

  useEffect(() => {
    (async () => {
      const dbPlayers = await loadJSON<Player[]>(KEYS.players, []);
      const selectedIds = await loadJSON<string[]>(KEYS.selected, []);
      const storedLineup = await loadJSON<StoredLineup | null>(
        KEYS.lineup,
        null
      );

      const playerMap = new Map(dbPlayers.map((p) => [p.id, p]));
      const availableIds = selectedIds.filter((id) => playerMap.has(id));

      const storedStarters = (storedLineup?.starters ?? []).filter((id) =>
        availableIds.includes(id)
      );
      const storedBench = (storedLineup?.bench ?? []).filter(
        (id) => availableIds.includes(id) && !storedStarters.includes(id)
      );

      const used = new Set([...storedStarters, ...storedBench]);
      const remainder = availableIds.filter((id) => !used.has(id));
      const orderedIds = [...storedStarters, ...storedBench, ...remainder];

      const orderedPlayers = orderedIds
        .map((id) => playerMap.get(id))
        .filter((p): p is Player => Boolean(p));

      let nextStarters = [...storedStarters];
      if (nextStarters.length > 5) {
        nextStarters = nextStarters.slice(0, 5);
      }
      if (nextStarters.length < 5) {
        for (const id of orderedIds) {
          if (nextStarters.length >= 5) break;
          if (!nextStarters.includes(id)) {
            nextStarters.push(id);
          }
        }
      }

      setPlayers(orderedPlayers);
      setStarters(nextStarters);
      setLoading(false);
    })();
  }, []);

  const showToast = (
    message: string,
    type: "success" | "warning" | "info" = "info"
  ) => {
    setToast({ message, type });

    Animated.timing(toastY, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    Haptics.notificationAsync(
      type === "warning"
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success
    ).catch(() => {});

    setTimeout(
      () => {
        Animated.timing(toastY, {
          toValue: 80,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start(() => setToast(null));
      },
      type === "warning" ? 2000 : 1500
    );
  };

  const handleGo = async () => {
    if (starters.length < 5) return;
    const startersTrimmed = starters.slice(0, 5);
    const benchIds = players
      .map((p) => p.id)
      .filter((id) => !startersTrimmed.includes(id));

    await saveJSON(KEYS.lineup, {
      starters: startersTrimmed,
      bench: benchIds,
    });

    showToast("Lineup saved! Let's play!", "success");
    setTimeout(() => router.push("/game-court"), 800);
  };

  const toggleStarter = (id: string) => {
    setStarters((prev) => {
      const isStarter = prev.includes(id);
      if (isStarter) {
        showToast("Moved to bench", "info");
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 5) {
        showToast("Only 5 can start! Remove someone first", "warning");
        return prev;
      }
      showToast("Added to starting 5", "success");
      return [...prev, id];
    });
  };

  const clearStarters = () => {
    if (starters.length === 0) return;
    setStarters([]);
    showToast("Starting lineup cleared", "info");
  };

  const PlayerTile = ({ p }: { p: Player }) => {
    const isStarter = starters.includes(p.id);
    return (
      <Pressable
        onPress={() => toggleStarter(p.id)}
        style={styles.playerTile}
        android_ripple={{ color: "rgba(15,23,42,0.06)" }}
      >
        <View style={[styles.avatar, isStarter && styles.avatarSelected]}>
          <Text style={styles.avatarInitial}>
            {p.name.trim()[0]?.toUpperCase() || "A"}
          </Text>
          {isStarter && (
            <View style={styles.avatarBadge}>
              <Ionicons
                name="checkmark"
                size={moderateScale(10)}
                color="#FFFFFF"
              />
            </View>
          )}
        </View>
        <Text style={styles.playerName} numberOfLines={1}>
          {p.name}
        </Text>
      </Pressable>
    );
  };

  // Dynamic grid columns based on device
  const numColumns = isLargeTablet ? 5 : isTablet ? 4 : isTinyDevice ? 2 : 3;
  const gridKey = `grid-${numColumns}`;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.screen}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.navButton}
            >
              <Ionicons
                name="chevron-back"
                size={moderateScale(20)}
                color={COLORS.text}
              />
            </Pressable>
            <Text style={styles.heading}>Starting Lineup</Text>
            <Pressable
              onPress={clearStarters}
              hitSlop={12}
              style={[
                styles.resetButton,
                starters.length === 0 && styles.resetButtonDisabled,
              ]}
              disabled={starters.length === 0}
            >
              <Ionicons
                name="refresh"
                size={moderateScale(14)}
                color={starters.length === 0 ? COLORS.textMuted : COLORS.accent}
              />
              {!isTinyDevice && (
                <Text
                  style={[
                    styles.resetButtonText,
                    starters.length === 0 && styles.resetButtonTextDisabled,
                  ]}
                >
                  Clear
                </Text>
              )}
            </Pressable>
          </View>

          {/* Counter Bar */}
          <View style={styles.counterBar}>
            <View style={styles.counterLeft}>
              <View style={styles.counterCircle}>
                <Text style={styles.counterNumber}>
                  {Math.min(starters.length, 5)}
                </Text>
              </View>
              <Text style={styles.counterLabel}>of 5 selected</Text>
            </View>
            <Text style={styles.counterHint}>Tap players to set lineup</Text>
          </View>

          {/* Player Grid */}
          <View style={styles.gridCard}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.accent} size="large" />
              </View>
            ) : players.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="people-circle-outline"
                  size={moderateScale(48)}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyTitle}>No players selected</Text>
                <Text style={styles.emptyText}>
                  Go back and select players for today&apos;s game
                </Text>
                <Pressable
                  onPress={() => router.back()}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Add Players</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={players}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                key={gridKey}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => <PlayerTile p={item} />}
              />
            )}
          </View>

          {/* Starting 5 Preview */}
          <View style={styles.lineupCard}>
            <View style={styles.lineupHeader}>
              <View style={styles.lineupTitleRow}>
                <Ionicons
                  name="star"
                  size={moderateScale(16)}
                  color={COLORS.success}
                />
                <Text style={styles.lineupLabel}>Starting 5</Text>
              </View>
              {starters.length === 5 && (
                <View style={styles.readyBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={moderateScale(12)}
                    color={COLORS.success}
                  />
                  <Text style={styles.readyText}>Ready</Text>
                </View>
              )}
            </View>

            <View style={styles.lineupFive}>
              {Array.from({ length: 5 }).map((_, index) => {
                const id = starters[index];
                const player = players.find((p) => p.id === id);
                return (
                  <View key={index} style={styles.slot}>
                    {player ? (
                      <>
                        <View style={styles.stripAvatar}>
                          <Text style={styles.stripInitial}>
                            {player.name.trim()[0]?.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.slotName} numberOfLines={1}>
                          {player.name}
                        </Text>
                      </>
                    ) : (
                      <View style={styles.placeholder}>
                        <Ionicons
                          name="person-add"
                          size={moderateScale(16)}
                          color={COLORS.textMuted}
                        />
                        <Text style={styles.placeholderLabel}>{index + 1}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            <Pressable
              disabled={loading || starters.length < 5}
              onPress={handleGo}
              style={[
                styles.goButton,
                (loading || starters.length < 5) && styles.goButtonDisabled,
              ]}
              android_ripple={{ color: "rgba(255,255,255,0.25)" }}
            >
              <Text style={styles.goButtonText}>
                {loading
                  ? "Loading..."
                  : starters.length < 5
                  ? `Select ${5 - starters.length} more`
                  : "Start Game"}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={moderateScale(16)}
                color="#FFFFFF"
                style={{ marginLeft: 6 }}
              />
            </Pressable>
          </View>

          {/* Toast */}
          {toast && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.toast,
                toast.type === "success" && styles.toastSuccess,
                toast.type === "warning" && styles.toastWarning,
                {
                  opacity: toastY.interpolate({
                    inputRange: [0, 80],
                    outputRange: [1, 0],
                  }),
                  transform: [{ translateY: toastY }],
                },
              ]}
            >
              <Ionicons
                name={
                  toast.type === "success"
                    ? "checkmark-circle"
                    : toast.type === "warning"
                    ? "warning"
                    : "information-circle"
                }
                size={moderateScale(18)}
                color="#FFFFFF"
              />
              <Text style={styles.toastText}>{toast.message}</Text>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screen: {
    flex: 1,
    paddingHorizontal: isLargeTablet
      ? 48
      : isTablet
      ? 32
      : isTinyDevice
      ? 16
      : isSmallDevice
      ? 20
      : 24,
    paddingTop: Platform.select({ ios: 12, android: 16, default: 12 }),
    paddingBottom: isShortDevice ? 16 : 20,
    maxWidth: isTablet ? 900 : undefined,
    alignSelf: "center",
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: isShortDevice ? 16 : isTablet ? 24 : 20,
  },
  navButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heading: {
    fontSize: moderateScale(22),
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  resetButton: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  resetButtonDisabled: {
    borderColor: COLORS.divider,
  },
  resetButtonText: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    color: COLORS.accent,
  },
  resetButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  counterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: isShortDevice ? 14 : isTablet ? 22 : 18,
    paddingHorizontal: 4,
  },
  counterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
  },
  counterCircle: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.successSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  counterNumber: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: COLORS.success,
  },
  counterLabel: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: COLORS.text,
  },
  counterHint: {
    fontSize: moderateScale(11),
    color: COLORS.textMuted,
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
  },
  gridCard: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  gridRow: {
    justifyContent:
      isLargeTablet || isTablet
        ? "flex-start"
        : isTinyDevice
        ? "space-around"
        : "space-between",
    marginBottom: isShortDevice ? 12 : isTablet ? 20 : 16,
    paddingHorizontal: isTablet ? 8 : 0,
  },
  gridContent: {
    paddingBottom: 20,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: COLORS.text,
  },
  emptyText: {
    fontSize: moderateScale(13),
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(12),
    borderRadius: 999,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  playerTile: {
    width: isLargeTablet
      ? "18%"
      : isTablet
      ? "23%"
      : isTinyDevice
      ? "45%"
      : "30%",
    alignItems: "center",
    marginHorizontal: isTablet ? 8 : 0,
    marginBottom: isTablet ? 4 : 0,
  },
  avatar: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  avatarSelected: {
    backgroundColor: COLORS.successSoft,
    borderColor: COLORS.success,
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: moderateScale(18),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarInitial: {
    fontSize: moderateScale(22),
    fontWeight: "700",
    color: COLORS.text,
  },
  playerName: {
    marginTop: 8,
    fontSize: moderateScale(12),
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    maxWidth: moderateScale(80),
  },
  lineupCard: {
    marginTop: isShortDevice ? 14 : isTablet ? 22 : 18,
    borderRadius: isTablet ? 20 : 16,
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(18),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.15)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  lineupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  lineupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lineupLabel: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: COLORS.text,
  },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: 999,
    backgroundColor: COLORS.successSoft,
  },
  readyText: {
    fontSize: moderateScale(11),
    fontWeight: "600",
    color: COLORS.success,
  },
  lineupFive: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: isTablet ? 12 : 0,
  },
  slot: {
    alignItems: "center",
    width: moderateScale(52),
  },
  stripAvatar: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    backgroundColor: COLORS.successSoft,
    borderWidth: 2,
    borderColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stripInitial: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: COLORS.text,
  },
  slotName: {
    fontSize: moderateScale(10),
    color: COLORS.text,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: moderateScale(48),
  },
  placeholder: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    borderWidth: 2,
    borderColor: COLORS.divider,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    marginBottom: 6,
  },
  placeholderLabel: {
    fontSize: moderateScale(10),
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "600",
  },
  goButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingVertical: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: moderateScale(48),
  },
  goButtonDisabled: {
    backgroundColor: COLORS.accentSoft,
  },
  goButtonText: {
    color: "#FFFFFF",
    fontSize: moderateScale(15),
    fontWeight: "700",
  },
  toast: {
    position: "absolute",
    bottom: isShortDevice ? 180 : isTablet ? 220 : 200,
    left: isLargeTablet ? 48 : isTablet ? 32 : isTinyDevice ? 16 : 20,
    right: isLargeTablet ? 48 : isTablet ? 32 : isTinyDevice ? 16 : 20,
    alignSelf: "center",
    maxWidth: isTablet ? 500 : 400,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: "#1F2937",
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: "#059669",
  },
  toastWarning: {
    backgroundColor: "#D97706",
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: moderateScale(13),
    fontWeight: "600",
    flex: 1,
  },
});
