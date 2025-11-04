// app/team-statistic.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { loadJSON, saveJSON } from "../lib/storage";

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    const history = await loadJSON<SavedGameSnapshot[]>(STORAGE_KEY, []);
    history.sort((a, b) => b.endedAt - a.endedAt);
    setGames(history);
    setTimeout(() => {
      if (history.length === 0) {
        setSelectedDate(null);
        return;
      }
      setSelectedDate((prev) => {
        if (prev && history.some((g) => g.practiceDate === prev)) {
          return prev;
        }
        return history[0]?.practiceDate ?? null;
      });
    }, 0);
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(history.map((g) => g.id));
      return new Set(Array.from(prev).filter((id) => valid.has(id)));
    });
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

  const gamesByDate = useMemo(() => {
    const map = new Map<string, SavedGameSnapshot[]>();
    games.forEach((game) => {
      const bucket = map.get(game.practiceDate) ?? [];
      bucket.push(game);
      map.set(game.practiceDate, bucket);
    });
    return map;
  }, [games]);

  const visibleGames = useMemo(() => {
    if (!selectedDate) return [];
    const list = gamesByDate.get(selectedDate) ?? [];
    return list.slice().sort((a, b) => b.endedAt - a.endedAt);
  }, [gamesByDate, selectedDate]);

  useEffect(() => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  }, [selectedDate, selectionMode]);

  useEffect(() => {
    if (games.length === 0) {
      setSelectedDate(null);
      return;
    }
    if (!selectedDate) {
      setSelectedDate(games[0].practiceDate);
    }
  }, [games, selectedDate]);

  useEffect(() => {
    if (!games.length) return;
    const selected = selectedDate ? new Date(selectedDate) : null;
    if (
      !selected ||
      selected.getMonth() !== currentMonth.getMonth() ||
      selected.getFullYear() !== currentMonth.getFullYear()
    ) {
      const monthGames = games
        .filter((g) => {
          const d = new Date(g.practiceDate + "T00:00:00");
          return (
            d.getMonth() === currentMonth.getMonth() &&
            d.getFullYear() === currentMonth.getFullYear()
          );
        })
        .sort((a, b) => b.endedAt - a.endedAt);
      if (monthGames.length > 0) {
        setSelectedDate(monthGames[0].practiceDate);
      } else if (selectedDate) {
        setSelectedDate(null);
      }
    }
  }, [currentMonth, games, selectedDate]);

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      const next = !prev;
      setSelectedIds(new Set());
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(visibleGames.map((g) => g.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectOlderThan = (days: number) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const ids = games.filter((g) => g.endedAt < cutoff).map((g) => g.id);
    setSelectedIds(new Set(ids));
    if (ids.length === 0) {
      Alert.alert("Nothing to select", `No games older than ${days} days.`);
    }
  };

  const removeSelected = async () => {
    if (selectedIds.size === 0) {
      Alert.alert("Select games", "Pick at least one game to remove.");
      return;
    }
    Alert.alert(
      "Clear selected history",
      "This will permanently delete the chosen games. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const remaining = games.filter((g) => !selectedIds.has(g.id));
            await saveJSON(STORAGE_KEY, remaining);
            setGames(remaining);
            setSelectedIds(new Set());
            setSelectionMode(false);
            if (selectedDate && !remaining.some((g) => g.practiceDate === selectedDate)) {
              setSelectedDate(remaining[0]?.practiceDate ?? null);
            }
          },
        },
      ]
    );
  };

  const renderGameItem = ({ item }: { item: SavedGameSnapshot }) => {
    const timeRange = formatGameTimeRange(item.startedAt, item.endedAt);
    const summary = `${item.players.length} players · ${formatSeconds(
      Math.round(item.totalGameSeconds)
    )}`;
    const isSelected = selectedIds.has(item.id);
    return (
      <Pressable
        style={styles.gameRow}
        onPress={() => {
          if (selectionMode) {
            toggleSelect(item.id);
            return;
          }
          router.push({ pathname: "/game-stat", params: { gameId: item.id } });
        }} 
        hitSlop={6}
      >
        <View>
          <Text style={styles.gameRowTitle}>{timeRange}</Text>
          <Text style={styles.gameRowMeta}>{summary}</Text>
        </View>
        {selectionMode ? (
          <Ionicons
            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
            size={18}
            color={isSelected ? UNI_THEME.accent : UNI_THEME.muted}
          />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={UNI_THEME.accent} />
        )}
      </Pressable>
    );
  };

  const listEmptyComponent = (
    <View style={styles.emptyState}>
      <Ionicons
        name="bar-chart-outline"
        size={28}
        color={UNI_THEME.accent}
        style={{ marginBottom: 12 }}
      />
      <Text style={styles.emptyStateTitle}>No games tracked</Text>
      <Text style={styles.emptyStateText}>
        Finish a session to see it here.
      </Text>
    </View>
  );

  const dayEmptyComponent = (
    <View style={styles.emptyState}>
      <Ionicons
        name="calendar-outline"
        size={26}
        color={UNI_THEME.accent}
        style={{ marginBottom: 10 }}
      />
      <Text style={styles.emptyStateTitle}>No games on this day</Text>
      <Text style={styles.emptyStateText}>Pick another date to review sessions.</Text>
    </View>
  );

  const calendarDays = useMemo(() => {
    const base = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstWeekday = base.getDay();
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const totalSlots = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const days: { key: string; label: number; inMonth: boolean }[] = [];
    for (let slot = 0; slot < totalSlots; slot++) {
      const date = new Date(base);
      date.setDate(1 + slot - firstWeekday);
      const inMonth = date.getMonth() === base.getMonth();
      const key = date.toISOString().slice(0, 10);
      days.push({ key, label: date.getDate(), inMonth });
    }
    return days;
  }, [currentMonth]);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [currentMonth]);

  const gameCountForDay = useCallback(
    (dateKey: string) => gamesByDate.get(dateKey)?.length ?? 0,
    [gamesByDate]
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

          <Text style={styles.headerTitle}>
            {selectionMode
              ? `${selectedIds.size} selected`
              : "Team history"}
          </Text>

          <View style={styles.headerActions}>
            {selectionMode ? (
              <Pressable
                onPress={toggleSelectionMode}
                hitSlop={10}
                style={styles.headerIconBtn}
              >
                <Ionicons name="close" size={18} color={UNI_THEME.text} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push("/home")}
                hitSlop={10}
                style={styles.headerIconBtn}
              >
                <Ionicons name="home" size={20} color={UNI_THEME.accent} />
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                if (selectionMode) {
                  removeSelected();
                } else {
                  toggleSelectionMode();
                }
              }}
              hitSlop={10}
              style={[styles.headerIconBtn, { marginLeft: 8 }]}
            >
              <Ionicons
                name={selectionMode ? "trash" : "trash-outline"}
                size={18}
                color={selectionMode ? UNI_THEME.accent : UNI_THEME.text}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.monthHeader}>
          <Pressable
            onPress={() =>
              setCurrentMonth(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() - 1,
                  1
                )
              )
            }
            hitSlop={10}
            style={styles.monthArrow}
          >
            <Ionicons name="chevron-back" size={18} color={UNI_THEME.text} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable
            onPress={() =>
              setCurrentMonth(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() + 1,
                  1
                )
              )
            }
            hitSlop={10}
            style={styles.monthArrow}
          >
            <Ionicons name="chevron-forward" size={18} color={UNI_THEME.text} />
          </Pressable>
        </View>

        <View style={styles.calendarGrid}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Text key={day} style={styles.calendarWeekLabel}>
              {day}
            </Text>
          ))}
          {calendarDays.map((day) => {
            const count = gameCountForDay(day.key);
            const isSelected = selectedDate === day.key;
            return (
              <Pressable
                key={day.key}
                onPress={() => {
                  if (!day.inMonth) {
                    setCurrentMonth(
                      new Date(
                        new Date(day.key).getFullYear(),
                        new Date(day.key).getMonth(),
                        1
                      )
                    );
                  }
                  setSelectedDate(day.key);
                }}
                style={[
                  styles.calendarCell,
                  !day.inMonth && styles.calendarCellMuted,
                  isSelected && styles.calendarCellSelected,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDate,
                    !day.inMonth && { color: UNI_THEME.muted },
                    isSelected && { color: "#FFFFFF" },
                  ]}
                >
                  {day.label}
                </Text>
                {count > 0 ? (
                  <View style={styles.calendarDot} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.dayHeading}>
          {selectedDate ? formatPracticeDate(selectedDate) : "No date selected"}
        </Text>

        {selectionMode ? (
          <View style={styles.selectionToolbar}>
            <Pressable style={styles.selectionButton} onPress={selectAll}>
              <Ionicons name="checkmark-done" size={14} color={UNI_THEME.accent} style={{ marginRight: 6 }} />
              <Text style={styles.selectionButtonText}>Select all</Text>
            </Pressable>
            <Pressable style={styles.selectionButton} onPress={clearSelection}>
              <Ionicons name="close-circle" size={14} color={UNI_THEME.accent} style={{ marginRight: 6 }} />
              <Text style={styles.selectionButtonText}>Clear selection</Text>
            </Pressable>
            <View style={styles.selectionFilters}>
              <Text style={styles.selectionFiltersLabel}>Older than</Text>
              <View style={styles.selectionFilterButtons}>
                <Pressable
                  style={styles.selectionChip}
                  onPress={() => selectOlderThan(7)}
                >
                  <Text style={styles.selectionChipText}>1 week</Text>
                </Pressable>
                <Pressable
                  style={styles.selectionChip}
                  onPress={() => selectOlderThan(14)}
                >
                  <Text style={styles.selectionChipText}>2 weeks</Text>
                </Pressable>
                <Pressable
                  style={styles.selectionChip}
                  onPress={() => selectOlderThan(30)}
                >
                  <Text style={styles.selectionChipText}>1 month</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <FlatList
          data={visibleGames}
          keyExtractor={(item) => item.id}
          renderItem={renderGameItem}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          contentContainerStyle={[
            styles.listContent,
            visibleGames.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={games.length === 0 ? listEmptyComponent : dayEmptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: UNI_THEME.text,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 16,
  },
  monthArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UNI_THEME.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: UNI_THEME.divider,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: UNI_THEME.text,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: UNI_THEME.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: UNI_THEME.divider,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  calendarWeekLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: UNI_THEME.muted,
    marginBottom: 4,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 4,
    borderRadius: 12,
  },
  calendarCellMuted: {
    opacity: 0.4,
  },
  calendarCellSelected: {
    backgroundColor: UNI_THEME.accent,
  },
  calendarDate: {
    fontSize: 13,
    fontWeight: "600",
    color: UNI_THEME.text,
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: UNI_THEME.accent,
    marginTop: 4,
  },
  dayHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: UNI_THEME.text,
    marginBottom: 12,
    textAlign: "center",
  },
  selectionToolbar: {
    backgroundColor: UNI_THEME.accentMuted,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 10,
  },
  selectionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  selectionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: UNI_THEME.accent,
  },
  selectionFilters: {
    marginTop: 4,
    gap: 6,
  },
  selectionFiltersLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: UNI_THEME.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectionFilterButtons: {
    flexDirection: "row",
    gap: 8,
  },
  selectionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: UNI_THEME.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: UNI_THEME.accent,
  },
  selectionChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: UNI_THEME.accent,
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
    color: UNI_THEME.muted,
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
