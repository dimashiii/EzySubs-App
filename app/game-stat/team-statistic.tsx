// app/team-statistic.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SectionList,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { loadJSON } from "../../lib/storage";

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

type PracticeSection = {
  title: string;
  rawDate: string;
  data: SavedGameSnapshot[];
};

const STORAGE_KEY = "gameHistory";

const UNI_THEME = {
  background: "#F4F7FF",
  card: "#FFFFFF",
  accent: "#2563EB",
  accentMuted: "rgba(37,99,235,0.12)",
  text: "#0F172A",
  muted: "#475569",
  divider: "rgba(37,99,235,0.18)",
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

export default function TeamStatisticScreen() {
  const [games, setGames] = useState<SavedGameSnapshot[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    const history = await loadJSON<SavedGameSnapshot[]>(STORAGE_KEY, []);
    history.sort((a, b) => b.endedAt - a.endedAt);
    setGames(history);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [loadGames])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  }, [loadGames]);

  const sections: PracticeSection[] = useMemo(() => {
    if (games.length === 0) return [];
    const map = new Map<string, SavedGameSnapshot[]>();
    games.forEach((game) => {
      const bucket = map.get(game.practiceDate) ?? [];
      bucket.push(game);
      map.set(game.practiceDate, bucket);
    });

    return Array.from(map.entries())
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .map(([rawDate, items]) => ({
        title: formatPracticeDate(rawDate),
        rawDate,
        data: items.sort((a, b) => b.endedAt - a.endedAt),
      }));
  }, [games]);

  const renderGameItem = ({ item }: { item: SavedGameSnapshot }) => {
    const timeRange = formatGameTimeRange(item.startedAt, item.endedAt);
    const summary = `${item.players.length} players · ${formatSeconds(
      Math.round(item.totalGameSeconds)
    )}`;
    return (
      <Pressable
        style={styles.gameRow}
        onPress={() =>
          router.push({ pathname: "/game-stat", params: { gameId: item.id } })
        }
        hitSlop={6}
      >
        <View>
          <Text style={styles.gameRowTitle}>{timeRange}</Text>
          <Text style={styles.gameRowMeta}>{summary}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={UNI_THEME.accent} />
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: PracticeSection }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  );

  const listEmptyComponent = (
    <View style={styles.emptyState}>
      <Ionicons
        name="bar-chart-outline"
        size={28}
        color={UNI_THEME.accent}
        style={{ marginBottom: 12 }}
      />
      <Text style={styles.emptyStateTitle}>No games tracked yet</Text>
      <Text style={styles.emptyStateText}>
        When you finish a session, it will appear here for quick review.
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.headerIconBtn}
          >
            <Ionicons name="chevron-back" size={20} color={UNI_THEME.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Team history</Text>

          <Pressable
            onPress={() => router.push("/home")}
            hitSlop={10}
            style={styles.headerIconBtn}
          >
            <Ionicons name="home" size={20} color={UNI_THEME.accent} />
          </Pressable>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderGameItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.listContent,
            sections.length === 0 && styles.listContentEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          SectionSeparatorComponent={() => <View style={{ height: 16 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={listEmptyComponent}
          showsVerticalScrollIndicator={false}
          style={styles.sectionList}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.select({ ios: 8, android: 16 }),
    backgroundColor: UNI_THEME.background,
  },
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
    backgroundColor: UNI_THEME.accentMuted,
  },
  headerIconBtnDisabled: {
    opacity: 0.4,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: UNI_THEME.text,
  },
  sectionList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: UNI_THEME.accent,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: UNI_THEME.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: UNI_THEME.divider,
  },
  gameRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: UNI_THEME.text,
  },
  gameRowMeta: {
    marginTop: 2,
    fontSize: 12,
    color: UNI_THEME.muted,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: UNI_THEME.divider,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: UNI_THEME.text,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 13,
    color: UNI_THEME.muted,
    textAlign: "center",
  },
});
