// app/game-settings/lineup.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Stack, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadJSON, saveJSON } from "../../lib/storage";

type Player = { id: string; name: string };
type StoredLineup = { starters: string[]; bench: string[] };

const KEYS = {
  players: "playersDB",
  selected: "selectedPlayers",
  lineup: "gameLineup",
};

const LAYOUT = {
  pad: 24,
  gap: 18,
  avatar: 66,
  avatarRing: 2,
  stripAvatar: 58,
};

const COLORS = {
  text: "#0F172A",
  textMuted: "#64748B",
  bg: "#FFFFFF",
  card: "#FFFFFF",
  accent: "#2563EB",
  accentSoft: "rgba(37,99,235,0.12)",
  success: "#22C55E",
  successSoft: "rgba(34,197,94,0.12)",
  divider: "rgba(15,23,42,0.06)",
  tileBorder: "rgba(15,23,42,0.05)",
  toastBg: "rgba(17,24,39,0.94)",
  toastText: "#FFFFFF",
};

export default function LineupScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastY = useState(new Animated.Value(60))[0];

  useEffect(() => {
    (async () => {
      const dbPlayers = await loadJSON<Player[]>(KEYS.players, []);
      const selectedIds = await loadJSON<string[]>(KEYS.selected, []);
      const storedLineup =
        await loadJSON<StoredLineup | null>(KEYS.lineup, null);

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

  const showToast = (msg: string) => {
    setToastMsg(msg);

    Animated.timing(toastY, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );

    setTimeout(() => {
      Animated.timing(toastY, {
        toValue: 60,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => setToastMsg(null));
    }, 1600);
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

    router.push("/game-court");
  };

  const toggleStarter = (id: string) => {
    setStarters((prev) => {
      const isStarter = prev.includes(id);
      if (isStarter) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 5) {
        showToast("Only five can start. Deselect someone first.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const clearStarters = () => {
    if (starters.length === 0) return;
    setStarters([]);
  };

  const PlayerTile = ({ p }: { p: Player }) => {
    const isStarter = starters.includes(p.id);
    return (
      <Pressable
        onPress={() => toggleStarter(p.id)}
        style={[
          styles.playerTile,
          isStarter && styles.playerTileSelected,
        ]}
        android_ripple={{ color: "rgba(15,23,42,0.08)" }}
      >
        <View
          style={[
            styles.avatar,
            isStarter && styles.avatarSelected,
          ]}
        >
          <Text style={styles.avatarInitial}>
            {p.name.trim()[0]?.toUpperCase() || "A"}
          </Text>
        </View>
        <Text style={styles.playerName} numberOfLines={1}>
          {p.name}
        </Text>
        {isStarter ? (
          <View style={styles.starterTag}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={COLORS.success}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.starterTagText}>Starter</Text>
          </View>
        ) : (
          <View style={styles.benchTag}>
            <Text style={styles.benchTagText}>Bench</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.screen}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={styles.navButton}
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.text} />
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={styles.heading}>Starting lineup</Text>
              <Text style={styles.subtitle}>
                Tap to choose up to five who open the game.
              </Text>
            </View>
            <Pressable
              onPress={clearStarters}
              hitSlop={10}
              style={[
                styles.resetButton,
                starters.length === 0 && styles.resetButtonDisabled,
              ]}
              disabled={starters.length === 0}
            >
              <Ionicons
                name="refresh"
                size={16}
                color={
                  starters.length === 0
                    ? COLORS.textMuted
                    : COLORS.accent
                }
              />
              <Text
                style={[
                  styles.resetButtonText,
                  starters.length === 0 && styles.resetButtonTextDisabled,
                ]}
              >
                Reset
              </Text>
            </Pressable>
          </View>

          <View style={styles.counterRow}>
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>
                {Math.min(starters.length, 5)} / 5 starters selected
              </Text>
            </View>
            <Text style={styles.counterHint}>
              Green tiles open on court, blue stay bench ready.
            </Text>
          </View>

          <View style={styles.gridCard}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : players.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="people-circle-outline"
                  size={36}
                  color={COLORS.textMuted}
                  style={{ marginBottom: 10 }}
                />
                <Text style={styles.emptyTitle}>No players yet</Text>
                <Text style={styles.emptyText}>
                  Head back and add your roster before setting a lineup.
                </Text>
              </View>
            ) : (
              <FlatList
                data={players}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => <PlayerTile p={item} />}
              />
            )}

            {toastMsg ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.toast,
                  {
                    opacity: toastY.interpolate({
                      inputRange: [0, 60],
                      outputRange: [1, 0],
                    }),
                    transform: [{ translateY: toastY }],
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={COLORS.toastText}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.toastText}>{toastMsg}</Text>
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.lineupCard}>
            <View style={styles.lineupHeaderRow}>
              <Text style={styles.lineupLabel}>Opening five preview</Text>
              <View style={styles.lineupBadge}>
                <Ionicons
                  name="sparkles"
                  size={14}
                  color={COLORS.success}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.lineupBadgeText}>Balanced start</Text>
              </View>
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
                          size={18}
                          color={COLORS.textMuted}
                          style={{ marginBottom: 4 }}
                        />
                        <Text style={styles.placeholderLabel}>Empty slot</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            <Pressable
              disabled={loading || starters.length < 5}
              onPress={() => {
                void handleGo();
              }}
              style={[
                styles.goButton,
                loading || starters.length < 5
                  ? styles.goButtonDisabled
                  : null,
              ]}
              android_ripple={{ color: "rgba(255,255,255,0.25)" }}
            >
              <Text style={styles.goButtonText}>
                {loading
                  ? "Checking roster…"
                  : starters.length < 5
                  ? "Select five"
                  : "Start game"}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color="#FFFFFF"
                style={{ marginLeft: 6 }}
              />
            </Pressable>
          </View>
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
    paddingHorizontal: LAYOUT.pad,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 22,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  resetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.accent,
    flexDirection: "row",
    alignItems: "center",
  },
  resetButtonDisabled: {
    borderColor: COLORS.divider,
  },
  resetButtonText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.accent,
  },
  resetButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  counterPill: {
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  counterText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.success,
  },
  counterHint: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 12,
  },
  gridCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    shadowColor: "rgba(15,23,42,0.12)",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: LAYOUT.gap,
  },
  gridContent: {
    paddingBottom: 12,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  playerTile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.tileBorder,
    shadowColor: "rgba(15,23,42,0.05)",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  playerTileSelected: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successSoft,
    shadowColor: "rgba(34,197,94,0.25)",
  },
  avatar: {
    width: LAYOUT.avatar,
    height: LAYOUT.avatar,
    borderRadius: LAYOUT.avatar / 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: COLORS.accentSoft,
    borderWidth: LAYOUT.avatarRing,
    borderColor: "transparent",
  },
  avatarSelected: {
    backgroundColor: COLORS.successSoft,
    borderColor: COLORS.success,
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  starterTag: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.successSoft,
    flexDirection: "row",
    alignItems: "center",
  },
  starterTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.success,
  },
  benchTag: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
  },
  benchTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.accent,
  },
  toast: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.toastBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    color: COLORS.toastText,
    fontSize: 13,
    fontWeight: "600",
  },
  lineupCard: {
    marginTop: 24,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: COLORS.card,
    shadowColor: "rgba(15,23,42,0.12)",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  lineupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  lineupLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  lineupBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.successSoft,
  },
  lineupBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.success,
  },
  lineupFive: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  slot: {
    width: (LAYOUT.stripAvatar * 1.2),
    alignItems: "center",
  },
  stripAvatar: {
    width: LAYOUT.stripAvatar,
    height: LAYOUT.stripAvatar,
    borderRadius: LAYOUT.stripAvatar / 2,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 2,
    borderColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  stripInitial: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  slotName: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "600",
  },
  placeholder: {
    width: LAYOUT.stripAvatar,
    height: LAYOUT.stripAvatar,
    borderRadius: LAYOUT.stripAvatar / 2,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.divider,
    marginBottom: 8,
  },
  placeholderLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  goButton: {
    marginTop: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  goButtonDisabled: {
    backgroundColor: COLORS.accentSoft,
  },
  goButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
