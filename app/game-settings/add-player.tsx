import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadJSON, saveJSON } from "../../lib/storage";

type Player = { id: string; name: string };

const KEYS = {
  players: "playersDB",
  selected: "selectedPlayers",
};

export default function AddPlayer() {
  // theme = palette so we can use theme.* in the header you gave
  const palette = useMemo(
    () => ({
      bg: "#FFFFFF",
      card: "#FFFFFF",
      text: "#0F172A",
      muted: "#64748B",
      accent: "#1976D2",
      warm: "#F57C00",
      amber: "#FB8C00",
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

  useEffect(() => {
    (async () => {
      const storedPlayers = await loadJSON<Player[]>(KEYS.players, []);
      const storedSelected = await loadJSON<string[]>(KEYS.selected, []);
      setPlayers(storedPlayers);
      setSelected(
        storedSelected.filter((id) => storedPlayers.some((p) => p.id === id))
      );
      setLoading(false);
    })();
  }, []);

  const persist = async (nextPlayers = players, nextSelected = selected) => {
    await saveJSON(KEYS.players, nextPlayers);
    await saveJSON(KEYS.selected, nextSelected);
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, query]);

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
    const ids = filtered.map((p) => p.id);
    const next = Array.from(new Set([...selected, ...ids]));
    setSelected(next);
    persist(players, next);
  };

  const deselectAllVisible = () => {
    const ids = new Set(filtered.map((p) => p.id));
    const next = selected.filter((id) => !ids.has(id));
    setSelected(next);
    persist(players, next);
  };

  const removePlayers = (ids: string[]) => {
    if (ids.length === 0) return;
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
          },
        },
      ]
    );
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
    const id = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const nextPlayers = [...players, { id, name }].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const nextSelected = [...selected, id];
    setPlayers(nextPlayers);
    setSelected(nextSelected);
    setAdding(false);
    persist(nextPlayers, nextSelected);
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
      (p) =>
        p.id !== editing.id &&
        p.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      Alert.alert(
        "Duplicate name",
        "Another player already uses this name."
      );
      return;
    }
    const nextPlayers = players
      .map((p) => (p.id === editing.id ? { ...p, name } : p))
      .sort((a, b) => a.name.localeCompare(b.name));
    setPlayers(nextPlayers);
    setEditing(null);
    setEditedName("");
    persist(nextPlayers, selected);
  };

  const confirmSelection = () => {
    if (selected.length === 0) {
      Alert.alert("No players selected", "Pick at least one player.");
      return;
    }
    Alert.alert(
      "Saved",
      `Selected ${selected.length} players for today.`,
      [
        {
          text: "OK",
          onPress: () => router.replace("/game-settings/lineup"),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Player }) => {
    const checked = selected.includes(item.id);
    return (
      <View style={[styles.row, checked && styles.rowSelected]}>
        <Pressable
          onPress={() => toggle(item.id)}
          style={styles.rowPressable}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name.trim()[0]?.toUpperCase() || "A"}
            </Text>
          </View>
          <Text style={styles.playerName}>{item.name}</Text>
          <Pressable
            onPress={() => toggle(item.id)}
            hitSlop={8}
            style={[styles.checkbox, checked && styles.checkboxActive]}
          >
            {checked ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : null}
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
              size={16}
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
              size={16}
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
        <SafeAreaView style={{ flex: 1 }}>
          {/* top header row you asked for */}
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={10}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.text}
              />
            </Pressable>

            <Text
              style={[
                styles.heading,
                { color: theme.text },
              ]}
            >
              Add Players
            </Text>

            {/* spacer to balance flex, matches width of back button */}
            <View style={{ width: 40 }} />
          </View>

          {/* search + chips + roster list */}
          <View style={{ flex: 1 }}>
            <View style={styles.searchRow}>
              <Ionicons
                name="search"
                size={18}
                color="#6B7280"
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search roster"
                placeholderTextColor="#6B7280"
                style={styles.searchInput}
              />
              {query ? (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={10}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color="#6B7280"
                  />
                </Pressable>
              ) : null}
              <Pressable
                onPress={openAdd}
                hitSlop={10}
                style={{ marginLeft: 8 }}
              >
                <Ionicons
                  name="person-add"
                  size={24}
                  color={palette.accent}
                />
              </Pressable>
            </View>

            {selectedPlayers.length > 0 ? (
              <View style={styles.selectedWrap}>
                <Text style={styles.sectionLabel}>
                  Selected Today
                </Text>
                <View style={styles.chipRow}>
                  {selectedPlayers.map((player) => (
                    <Pressable
                      key={`chip-${player.id}`}
                      style={styles.chip}
                      onPress={() => toggle(player.id)}
                    >
                      <Text style={styles.chipText}>
                        {player.name}
                      </Text>
                      <Ionicons
                        name="close"
                        size={14}
                        color={palette.accent}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Text
              style={[
                styles.sectionLabel,
                { marginHorizontal: 16, marginBottom: 6 },
              ]}
            >
              Roster
            </Text>

            <FlatList
              data={filtered}
              keyExtractor={(p) => p.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor:
                      "rgba(15,23,42,0.08)",
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons
                    name="people-outline"
                    size={32}
                    color={palette.muted}
                  />
                  <Text
                    style={{
                      color: palette.muted,
                      marginTop: 8,
                    }}
                  >
                    {query
                      ? "No matching players"
                      : "No players yet"}
                  </Text>
                  <Pressable
                    onPress={openAdd}
                    style={{ marginTop: 12 }}
                  >
                    <Text
                      style={{
                        color: palette.accent,
                        fontWeight: "600",
                      }}
                    >
                      Add New Player
                    </Text>
                  </Pressable>
                </View>
              }
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 120,
              }}
            />
          </View>

          {/* bottom actions bar */}
          <View style={styles.bottomRow}>
            <Action
              icon="trash"
              label="Remove"
              onPress={() => removePlayers(selected)}
            />
            {filtered.length > 0 &&
            filtered.every((p) =>
              selected.includes(p.id)
            ) ? (
              <Action
                icon="square-outline"
                label="Clear"
                onPress={deselectAllVisible}
              />
            ) : (
              <Action
                icon="checkbox-outline"
                label="Select All"
                onPress={selectAllVisible}
              />
            )}
            <Action
              icon="checkmark-circle"
              label="Confirm"
              onPress={confirmSelection}
              primary
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ADD PLAYER MODAL */}
      <Modal
        visible={adding}
        transparent
        animationType="fade"
        onRequestClose={() => setAdding(false)}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios" ? "padding" : undefined
          }
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Player</Text>
            <View style={styles.modalInputRow}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Player name"
                style={styles.modalInput}
              />
              {newName ? (
                <Pressable
                  onPress={() => setNewName("")}
                  hitSlop={10}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
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
                <Text style={styles.modalSecondaryText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={newName.trim().length < 2}
                onPress={addPlayer}
                style={[
                  styles.modalPrimary,
                  newName.trim().length < 2 &&
                    styles.modalPrimaryDisabled,
                ]}
              >
                <Text style={styles.modalPrimaryText}>
                  Add Player
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT PLAYER MODAL */}
      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios" ? "padding" : undefined
          }
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Player</Text>
            <View style={styles.modalInputRow}>
              <TextInput
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Player name"
                style={styles.modalInput}
              />
              {editedName ? (
                <Pressable
                  onPress={() => setEditedName("")}
                  hitSlop={10}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
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
                <Text style={styles.modalSecondaryText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={editedName.trim().length < 2}
                onPress={saveEdit}
                style={[
                  styles.modalPrimary,
                  editedName.trim().length < 2 &&
                    styles.modalPrimaryDisabled,
                ]}
              >
                <Text style={styles.modalPrimaryText}>
                  Save
                </Text>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.actionButton}>
      <Ionicons
        name={icon}
        size={20}
        color={
          primary ? ACTION_PRIMARY_COLOR : ACTION_TEXT_COLOR
        }
      />
      <Text
        style={[
          styles.actionText,
          primary && { color: ACTION_PRIMARY_COLOR },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const ACTION_TEXT_COLOR = "#0F172A";
const ACTION_PRIMARY_COLOR = "#2563EB";

const styles = StyleSheet.create({
  // screen wrapper for KeyboardAvoidingView
  screen: {
    flex: 1,
  },

  // NEW HEADER ROW styles (mapped from your snippet)
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },

  // (old headerBar kept in case you reuse somewhere else)
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.2)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },

  searchRow: {
    marginHorizontal: 16,
    marginTop: 8, // reduced because we now have heading above
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FB",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
  },
  selectedWrap: {
    marginHorizontal: 16,
    marginBottom: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(200,205,212,0.6)",
    gap: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(245,124,0,0.14)",
  },
  chipText: {
    color: "#F57C00",
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  rowSelected: {
    backgroundColor: "rgba(25,118,210,0.08)",
  },
  rowPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 12,
  },
  rowActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontWeight: "700",
    color: "#1F2937",
    fontSize: 16,
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#6B7280",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: {
    borderColor: "#1976D2",
    backgroundColor: "#1976D2",
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 6,
  },
  bottomRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(25,118,210,0.18)",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACTION_TEXT_COLOR,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    padding: 20,
  },
  modalInputRow: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.16)",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.2)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  modalSecondaryText: {
    fontWeight: "600",
    color: "#111827",
  },
  modalPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F57C00",
  },
  modalPrimaryDisabled: {
    backgroundColor: "rgba(245,124,0,0.45)",
  },
  modalPrimaryText: {
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
