import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadJSON, saveJSON } from "../../lib/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Device detection
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_WIDTH < 350;
const isShortDevice = SCREEN_HEIGHT < 700;
const isTablet = SCREEN_WIDTH >= 768;

// Responsive scaling
const scale = (size: number) => {
  const ratio = SCREEN_WIDTH / 375;
  const clamped = Math.max(0.85, Math.min(ratio, 1.3));
  return size * clamped;
};
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

type Player = { id: string; name: string };

const KEYS = {
  players: "playersDB",
  selected: "selectedPlayers",
};

export default function AddPlayer() {
  const palette = useMemo(
    () => ({
      bg: "#FFFFFF",
      card: "#FFFFFF",
      text: "#0F172A",
      muted: "#64748B",
      accent: "#2563EB",
      warm: "#F97316",
      border: "rgba(15,23,42,0.12)",
    }),
    []
  );
  const theme = palette;

  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Player | null>(null);
  const [editedName, setEditedName] = useState("");
  const [loading, setLoading] = useState(true);
  const [recentlyRemoved, setRecentlyRemoved] = useState<{
    players: Player[];
    selected: string[];
  } | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "recent" | "frequent">("name");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info" | "warning";
  } | null>(null);

  useEffect(() => {
    (async () => {
      const storedPlayers = await loadJSON<Player[]>(KEYS.players, []);
      const storedSelected = await loadJSON<string[]>(KEYS.selected, []);
      const storedSort = await loadJSON<"name" | "recent" | "frequent">(
        "playerSortBy",
        "name"
      );
      setPlayers(storedPlayers);
      setSelected(
        storedSelected.filter((id) => storedPlayers.some((p) => p.id === id))
      );
      setSortBy(storedSort);
      setLoading(false);
    })();
  }, []);

  const persist = async (nextPlayers = players, nextSelected = selected) => {
    await saveJSON(KEYS.players, nextPlayers);
    await saveJSON(KEYS.selected, nextSelected);
  };

  const showToast = (
    message: string,
    type: "success" | "info" | "warning" = "info"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = q
      ? players.filter((p) => p.name.toLowerCase().includes(q))
      : players;

    // Sort based on current sort option
    if (sortBy === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "recent") {
      // Most recently added first (by ID timestamp)
      result = [...result].sort((a, b) => {
        const aTime = parseInt(a.id.split("-")[0]);
        const bTime = parseInt(b.id.split("-")[0]);
        return bTime - aTime;
      });
    } else if (sortBy === "frequent") {
      // Count how many times each player was selected (mock - could track this)
      // For now, show selected players first
      result = [...result].sort((a, b) => {
        const aSelected = selected.includes(a.id) ? 1 : 0;
        const bSelected = selected.includes(b.id) ? 1 : 0;
        return bSelected - aSelected;
      });
    }

    return result;
  }, [players, query, sortBy, selected]);

  const selectedPlayers = React.useMemo(
    () => players.filter((p) => selected.includes(p.id)),
    [players, selected]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      persist(players, next);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (filtered.length === 0) return;
    const ids = filtered.map((p) => p.id);
    const next = Array.from(new Set([...selected, ...ids]));
    setSelected(next);
    persist(players, next);
    showToast(
      `${filtered.length} player${filtered.length > 1 ? "s" : ""} selected`,
      "success"
    );
  };

  const deselectAllVisible = () => {
    if (filtered.length === 0) return;
    const ids = new Set(filtered.map((p) => p.id));
    const next = selected.filter((id) => !ids.has(id));
    setSelected(next);
    persist(players, next);
    showToast(
      `${filtered.length} player${filtered.length > 1 ? "s" : ""} deselected`,
      "info"
    );
  };

  const removePlayers = (ids: string[]) => {
    if (ids.length === 0) return;

    // Store for undo
    const playersToRemove = players.filter((p) => ids.includes(p.id));
    const selectedToRemove = selected.filter((id) => ids.includes(id));

    Alert.alert(
      ids.length === 1 ? "Remove player" : "Remove players",
      ids.length === 1
        ? "Remove this player from your roster?"
        : `Remove ${ids.length} players from your roster?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const setIds = new Set(ids);
            const nextPlayers = players.filter((p) => !setIds.has(p.id));
            const nextSelected = selected.filter((id) => !setIds.has(id));
            setPlayers(nextPlayers);
            setSelected(nextSelected);
            persist(nextPlayers, nextSelected);

            // Show undo option
            setRecentlyRemoved({
              players: playersToRemove,
              selected: selectedToRemove,
            });

            // Auto-hide undo after 5 seconds
            setTimeout(() => {
              setRecentlyRemoved(null);
            }, 5000);
          },
        },
      ]
    );
  };

  const undoRemove = () => {
    if (!recentlyRemoved) return;

    const nextPlayers = [...players, ...recentlyRemoved.players].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const nextSelected = [...selected, ...recentlyRemoved.selected];

    setPlayers(nextPlayers);
    setSelected(nextSelected);
    setRecentlyRemoved(null);
    persist(nextPlayers, nextSelected);

    showToast(
      `${recentlyRemoved.players.length} player${
        recentlyRemoved.players.length > 1 ? "s" : ""
      } restored`,
      "success"
    );
  };

  const changeSortBy = async (newSort: "name" | "recent" | "frequent") => {
    setSortBy(newSort);
    await saveJSON("playerSortBy", newSort);

    const sortLabels = {
      name: "Sorted by name",
      recent: "Sorted by recently added",
      frequent: "Sorted by selected first",
    };
    showToast(sortLabels[newSort], "info");
  };

  const openAdd = () => {
    setNewName("");
    setAdding(true);
  };

  const addPlayer = () => {
    const name = newName.trim();
    if (name.length < 2) return;
    const exists = players.some(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      Alert.alert("Duplicate name", "A player with this name already exists.");
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextPlayers = [...players, { id, name }].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const nextSelected = [...selected, id];
    setPlayers(nextPlayers);
    setSelected(nextSelected);
    setAdding(false);
    persist(nextPlayers, nextSelected);
    showToast(`${name} added to roster`, "success");
  };

  const beginEdit = (player: Player) => {
    setEditing(player);
    setEditedName(player.name);
  };

  const saveEdit = () => {
    if (!editing) return;
    const name = editedName.trim();
    if (name.length < 2) return;
    const duplicate = players.some(
      (p) => p.id !== editing.id && p.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      Alert.alert("Duplicate name", "Another player already uses this name.");
      return;
    }
    const nextPlayers = players
      .map((p) => (p.id === editing.id ? { ...p, name } : p))
      .sort((a, b) => a.name.localeCompare(b.name));
    setPlayers(nextPlayers);
    setEditing(null);
    setEditedName("");
    persist(nextPlayers, selected);
    showToast(`Player name updated`, "success");
  };

  const confirmSelection = () => {
    if (selected.length === 0) {
      Alert.alert("No players selected", "Pick at least one player.");
      return;
    }
    if (selected.length < 5) {
      Alert.alert(
        "Low player count",
        `You've selected ${selected.length} player${
          selected.length > 1 ? "s" : ""
        }. For 5v5 basketball, you typically need at least 5 players. Continue anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => {
              showToast(
                `${selected.length} player${
                  selected.length > 1 ? "s" : ""
                } ready for game`,
                "success"
              );
              setTimeout(() => router.replace("/game-settings/lineup"), 500);
            },
          },
        ]
      );
      return;
    }
    showToast(`${selected.length} players ready for game`, "success");
    setTimeout(() => router.replace("/game-settings/lineup"), 500);
  };

  const renderItem = ({ item }: { item: Player }) => {
    const checked = selected.includes(item.id);
    return (
      <View style={[styles.row, checked && styles.rowSelected]}>
        <Pressable onPress={() => toggle(item.id)} style={styles.rowPressable}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name.trim()[0]?.toUpperCase() || "A"}
            </Text>
          </View>
          <Text style={styles.playerName} numberOfLines={1}>
            {item.name}
          </Text>
          <Pressable
            onPress={() => toggle(item.id)}
            hitSlop={8}
            style={[styles.checkbox, checked && styles.checkboxActive]}
          >
            {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
          </Pressable>
        </Pressable>
        <View style={styles.rowActions}>
          <Pressable
            onPress={() => beginEdit(item)}
            hitSlop={10}
            style={styles.rowActionBtn}
          >
            <Ionicons
              name="pencil"
              size={isTinyDevice ? 14 : 16}
              color={palette.accent}
            />
          </Pressable>
          <Pressable
            onPress={() => removePlayers([item.id])}
            hitSlop={10}
            style={styles.rowActionBtn}
          >
            <Ionicons
              name="trash-outline"
              size={isTinyDevice ? 14 : 16}
              color={palette.warm}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: theme.bg,
          }}
        >
          <Text style={{ color: theme.text }}>Loading…</Text>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </Pressable>
            <Text style={[styles.heading, { color: theme.text }]}>
              Add Players
            </Text>
            <View style={{ width: isTinyDevice ? 36 : 40 }} />
          </View>

          {/* Search Bar + Sort */}
          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color="#6B7280" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search roster"
                placeholderTextColor="#6B7280"
                style={styles.searchInput}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color="#6B7280" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={openAdd}
                hitSlop={10}
                style={styles.addIconBtn}
              >
                <Ionicons
                  name="person-add"
                  size={isTinyDevice ? 20 : 22}
                  color={palette.accent}
                />
              </Pressable>
            </View>

            {/* Sort Options */}
            <View style={styles.sortRow}>
              <Pressable
                onPress={() => changeSortBy("name")}
                style={[
                  styles.sortTab,
                  sortBy === "name" && styles.sortTabActive,
                ]}
              >
                <Ionicons
                  name="text-outline"
                  size={14}
                  color={sortBy === "name" ? palette.accent : "#64748B"}
                />
                <Text
                  style={[
                    styles.sortTabText,
                    sortBy === "name" && styles.sortTabTextActive,
                  ]}
                >
                  Name
                </Text>
              </Pressable>

              <Pressable
                onPress={() => changeSortBy("recent")}
                style={[
                  styles.sortTab,
                  sortBy === "recent" && styles.sortTabActive,
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={sortBy === "recent" ? palette.accent : "#64748B"}
                />
                <Text
                  style={[
                    styles.sortTabText,
                    sortBy === "recent" && styles.sortTabTextActive,
                  ]}
                >
                  Recent
                </Text>
              </Pressable>

              <Pressable
                onPress={() => changeSortBy("frequent")}
                style={[
                  styles.sortTab,
                  sortBy === "frequent" && styles.sortTabActive,
                ]}
              >
                <Ionicons
                  name="star-outline"
                  size={14}
                  color={sortBy === "frequent" ? palette.accent : "#64748B"}
                />
                <Text
                  style={[
                    styles.sortTabText,
                    sortBy === "frequent" && styles.sortTabTextActive,
                  ]}
                >
                  Selected
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Selected Chips */}
          {selectedPlayers.length > 0 && (
            <View style={styles.selectedWrap}>
              <View style={styles.selectedHeader}>
                <Text style={styles.sectionLabel}>Playing Today</Text>
                <Text style={styles.selectedCount}>{selected.length}</Text>
              </View>
              <View style={styles.chipRow}>
                {selectedPlayers.map((player) => (
                  <Pressable
                    key={`chip-${player.id}`}
                    style={styles.chip}
                    onPress={() => toggle(player.id)}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <Ionicons name="close" size={12} color={palette.accent} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Roster List */}
          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>Roster ({filtered.length})</Text>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name="people-outline"
                  size={isTinyDevice ? 28 : 32}
                  color={palette.muted}
                />
                <Text style={styles.emptyText}>
                  {query ? "No matching players" : "No players yet"}
                </Text>
                <Pressable onPress={openAdd} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Add New Player</Text>
                </Pressable>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />

          {/* Undo Toast - Remove action */}
          {recentlyRemoved && (
            <View style={styles.undoToast}>
              <View style={styles.undoToastContent}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.undoToastText}>
                  {recentlyRemoved.players.length === 1
                    ? "Player removed"
                    : `${recentlyRemoved.players.length} players removed`}
                </Text>
              </View>
              <Pressable onPress={undoRemove} style={styles.undoButton}>
                <Text style={styles.undoButtonText}>UNDO</Text>
              </Pressable>
            </View>
          )}

          {/* General Toast Messages */}
          {toast && (
            <View
              style={[
                styles.toast,
                toast.type === "success" && styles.toastSuccess,
                toast.type === "warning" && styles.toastWarning,
              ]}
            >
              <Ionicons
                name={
                  toast.type === "success"
                    ? "checkmark-circle"
                    : toast.type === "warning"
                    ? "alert-circle"
                    : "information-circle"
                }
                size={18}
                color={
                  toast.type === "success"
                    ? "#10B981"
                    : toast.type === "warning"
                    ? "#F59E0B"
                    : "#3B82F6"
                }
              />
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          )}

          {/* Bottom Actions */}
          <View style={styles.bottomRow}>
            <Action
              icon="trash"
              label={isTinyDevice ? "Del" : "Remove"}
              onPress={() => removePlayers(selected)}
              disabled={selected.length === 0}
            />
            {filtered.length > 0 &&
            filtered.every((p) => selected.includes(p.id)) ? (
              <Action
                icon="square-outline"
                label={isTinyDevice ? "Clear" : "Clear All"}
                onPress={deselectAllVisible}
              />
            ) : (
              <Action
                icon="checkbox-outline"
                label={isTinyDevice ? "All" : "Select All"}
                onPress={selectAllVisible}
                disabled={filtered.length === 0}
              />
            )}
            <Action
              icon="checkmark-circle"
              label="Continue"
              onPress={confirmSelection}
              primary
              disabled={selected.length === 0}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ADD MODAL */}
      <Modal
        visible={adding}
        transparent
        animationType="fade"
        onRequestClose={() => setAdding(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAdding(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Player</Text>
            <View style={styles.modalInputRow}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Player name"
                placeholderTextColor="#9CA3AF"
                style={styles.modalInput}
                autoFocus
              />
              {newName ? (
                <Pressable onPress={() => setNewName("")} hitSlop={10}>
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color="#6B7280"
                  />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setAdding(false)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={newName.trim().length < 2}
                onPress={addPlayer}
                style={[
                  styles.modalPrimary,
                  newName.trim().length < 2 && styles.modalPrimaryDisabled,
                ]}
              >
                <Text style={styles.modalPrimaryText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setEditing(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Player</Text>
            <View style={styles.modalInputRow}>
              <TextInput
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Player name"
                placeholderTextColor="#9CA3AF"
                style={styles.modalInput}
                autoFocus
              />
              {editedName ? (
                <Pressable onPress={() => setEditedName("")} hitSlop={10}>
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color="#6B7280"
                  />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setEditing(null);
                  setEditedName("");
                }}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={editedName.trim().length < 2}
                onPress={saveEdit}
                style={[
                  styles.modalPrimary,
                  editedName.trim().length < 2 && styles.modalPrimaryDisabled,
                ]}
              >
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function Action({
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
    >
      <Ionicons
        name={icon}
        size={isTinyDevice ? 18 : 20}
        color={disabled ? "#9CA3AF" : primary ? "#2563EB" : "#0F172A"}
      />
      <Text
        style={[
          styles.actionText,
          primary && { color: "#2563EB" },
          disabled && { color: "#9CA3AF" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: isTinyDevice ? 16 : isSmallDevice ? 18 : 20,
    paddingTop: Platform.select({ ios: 12, android: 16, default: 12 }),
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  backButton: {
    width: isTinyDevice ? 36 : 40,
    height: isTinyDevice ? 36 : 40,
    borderRadius: isTinyDevice ? 18 : 20,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    flexShrink: 0,
  },
  heading: {
    fontSize: isTinyDevice ? 18 : isSmallDevice ? 19 : moderateScale(20),
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  searchContainer: {
    gap: 10,
  },
  searchRow: {
    marginHorizontal: isTinyDevice ? 16 : isSmallDevice ? 18 : 20,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FB",
    borderRadius: 12,
    paddingHorizontal: isTinyDevice ? 12 : 14,
    height: isTinyDevice ? 44 : 48,
    gap: isTinyDevice ? 6 : 8,
  },
  searchInput: {
    flex: 1,
    fontSize: isTinyDevice ? 14 : moderateScale(15),
    color: "#0F172A",
  },
  addIconBtn: {
    marginLeft: 4,
  },
  sortRow: {
    flexDirection: "row",
    marginHorizontal: isTinyDevice ? 16 : isSmallDevice ? 18 : 20,
    marginBottom: 16,
    gap: isTinyDevice ? 6 : 8,
    backgroundColor: "#F5F7FB",
    borderRadius: 10,
    padding: 4,
  },
  sortTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: isTinyDevice ? 6 : 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  sortTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sortTabText: {
    fontSize: isTinyDevice ? 10 : moderateScale(11),
    fontWeight: "600",
    color: "#64748B",
  },
  sortTabTextActive: {
    color: "#2563EB",
  },
  selectedWrap: {
    marginHorizontal: isTinyDevice ? 16 : isSmallDevice ? 18 : 20,
    marginBottom: 16,
    backgroundColor: "rgba(37,99,235,0.06)",
    borderRadius: 12,
    padding: isTinyDevice ? 12 : 14,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.15)",
  },
  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  selectedCount: {
    fontSize: isTinyDevice ? 12 : moderateScale(13),
    fontWeight: "700",
    color: "#2563EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sectionLabel: {
    fontSize: isTinyDevice ? 11 : moderateScale(12),
    fontWeight: "700",
    color: "#1F2937",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: isTinyDevice ? 6 : 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: isTinyDevice ? 10 : 12,
    paddingVertical: isTinyDevice ? 5 : 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.2)",
    maxWidth: SCREEN_WIDTH * 0.4,
  },
  chipText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: isTinyDevice ? 11 : moderateScale(12),
    flexShrink: 1,
  },
  listHeader: {
    paddingHorizontal: isTinyDevice ? 16 : isSmallDevice ? 18 : 20,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: isTinyDevice ? 10 : 12,
    paddingHorizontal: isTinyDevice ? 12 : 14,
    backgroundColor: "#FFFFFF",
  },
  rowSelected: {
    backgroundColor: "rgba(37,99,235,0.08)",
  },
  rowPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: isTinyDevice ? 10 : 12,
    minWidth: 0,
  },
  rowActions: {
    flexDirection: "row",
    gap: 6,
    marginLeft: 8,
    flexShrink: 0,
  },
  rowActionBtn: {
    width: isTinyDevice ? 28 : 30,
    height: isTinyDevice ? 28 : 30,
    borderRadius: isTinyDevice ? 14 : 15,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  avatar: {
    width: isTinyDevice ? 36 : 40,
    height: isTinyDevice ? 36 : 40,
    borderRadius: isTinyDevice ? 18 : 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: "700",
    color: "#1F2937",
    fontSize: isTinyDevice ? 14 : 16,
  },
  playerName: {
    flex: 1,
    fontSize: isTinyDevice ? 14 : moderateScale(15),
    color: "#0F172A",
    fontWeight: "500",
  },
  checkbox: {
    width: isTinyDevice ? 20 : 22,
    height: isTinyDevice ? 20 : 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#6B7280",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  checkboxActive: {
    borderColor: "#2563EB",
    backgroundColor: "#2563EB",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(15,23,42,0.08)",
    marginLeft: isTinyDevice ? 58 : 66,
  },
  listContent: {
    paddingHorizontal: isTinyDevice ? 16 : isSmallDevice ? 18 : 20,
    paddingBottom: isShortDevice ? 110 : 120,
  },
  emptyState: {
    paddingVertical: isShortDevice ? 50 : 60,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: "#64748B",
    fontSize: isTinyDevice ? 13 : moderateScale(14),
  },
  emptyButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 999,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: isTinyDevice ? 13 : moderateScale(14),
  },
  undoToast: {
    position: "absolute",
    bottom: isShortDevice ? 110 : 120,
    left: isTinyDevice ? 16 : 20,
    right: isTinyDevice ? 16 : 20,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  undoToastContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  undoToastText: {
    color: "#FFFFFF",
    fontSize: isTinyDevice ? 13 : moderateScale(14),
    fontWeight: "500",
    flex: 1,
  },
  undoButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderRadius: 8,
  },
  undoButtonText: {
    color: "#60A5FA",
    fontSize: isTinyDevice ? 12 : moderateScale(13),
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  toast: {
    position: "absolute",
    bottom: isShortDevice ? 110 : 120,
    left: isTinyDevice ? 16 : 20,
    right: isTinyDevice ? 16 : 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  toastSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  toastWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
  },
  toastText: {
    color: "#1F2937",
    fontSize: isTinyDevice ? 13 : moderateScale(14),
    fontWeight: "500",
    flex: 1,
  },
  bottomRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: isTinyDevice ? 20 : isSmallDevice ? 22 : 24,
    paddingTop: 14,
    paddingBottom: Platform.select({ ios: 20, android: 24, default: 20 }),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15,23,42,0.12)",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: isTinyDevice ? 12 : 16,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionText: {
    fontSize: isTinyDevice ? 11 : moderateScale(12),
    fontWeight: "600",
    color: "#0F172A",
  },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: isTinyDevice ? 16 : 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: isTinyDevice ? 18 : 20,
    gap: 16,
    maxWidth: isTablet ? 400 : undefined,
    alignSelf: "center",
    width: "100%",
  },
  modalTitle: {
    fontSize: isTinyDevice ? 16 : moderateScale(18),
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  modalInputRow: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.16)",
    borderRadius: 10,
    paddingHorizontal: isTinyDevice ? 12 : 14,
    height: isTinyDevice ? 44 : 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    gap: 8,
  },
  modalInput: {
    flex: 1,
    fontSize: isTinyDevice ? 14 : moderateScale(15),
    color: "#111827",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalSecondary: {
    flex: 1,
    height: isTinyDevice ? 44 : 48,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(37,99,235,0.2)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  modalSecondaryText: {
    fontWeight: "600",
    fontSize: isTinyDevice ? 14 : moderateScale(15),
    color: "#111827",
  },
  modalPrimary: {
    flex: 1,
    height: isTinyDevice ? 44 : 48,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  modalPrimaryDisabled: {
    backgroundColor: "rgba(37,99,235,0.4)",
  },
  modalPrimaryText: {
    fontWeight: "700",
    fontSize: isTinyDevice ? 14 : moderateScale(15),
    color: "#FFFFFF",
  },
});
