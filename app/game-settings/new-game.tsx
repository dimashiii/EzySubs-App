import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { loadJSON, saveJSON } from "../../lib/storage";
import TimeSelectField from "../../components/TimeSelectField";

const DEFAULT_SETTINGS = Object.freeze({
  halfTime: 18,
  quarterTime: 8,
  subsTime: 4,
});

const HALF_OPTIONS = [5, 8, 10, 12, 15, 18, 20, 24, 30, 40, 45, 50, 60];
const SUB_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12, 15];

type StoredSettings = {
  halfTime: number;
  quarterTime: number;
  subsTime: number;
};

type SettingsHistoryEntry = StoredSettings & {
  savedAt: string;
};

export default function NewGame() {
  const router = useRouter();
  const [times, setTimes] = useState<StoredSettings>({ ...DEFAULT_SETTINGS });

  const theme = useMemo(
    () => ({
      bg: "#FFFFFF",
      section: "#F8FAFC",
      text: "#0F172A",
      muted: "#64748B",
      border: "rgba(15,23,42,0.08)",
      accent: "#2563EB",
    }),
    []
  );

  useEffect(() => {
    (async () => {
      const seeded = await loadJSON<StoredSettings | null>(
        "gameSettingsDefaults",
        null
      );
      await AsyncStorage.removeItem("gameSettingsDefaults");

      if (seeded) {
        setTimes(normalizeTimes(seeded));
        return;
      }

      setTimes(normalizeTimes(DEFAULT_SETTINGS));
    })();
  }, []);

  const handleHalfChange = (minutes: number) => {
    const clamped = clampToRange(minutes, 5, 60);
    setTimes((prev) => {
      const quarterEnabled = prev.quarterTime > 0;
      return {
        ...prev,
        halfTime: clamped,
        quarterTime: quarterEnabled ? deriveQuarter(clamped) : 0,
      };
    });
  };

  const handleSubsChange = (minutes: number) => {
    setTimes((prev) => ({
      ...prev,
      subsTime: clampToRange(minutes, 1, 15),
    }));
  };

  const toggleQuarter = () => {
    setTimes((prev) => {
      const isEnabled = prev.quarterTime > 0;
      if (isEnabled) {
        return { ...prev, quarterTime: 0 };
      }
      const half = clampToRange(prev.halfTime, 5, 60);
      return { ...prev, halfTime: half, quarterTime: deriveQuarter(half) };
    });
  };

  const resetToDefaults = () => {
    setTimes(normalizeTimes(DEFAULT_SETTINGS));
  };

  const confirm = async () => {
    const cleaned = normalizeTimes(times);
    const nothingSet =
      cleaned.halfTime === 0 &&
      cleaned.quarterTime === 0 &&
      cleaned.subsTime === 0;

    if (nothingSet) {
      Alert.alert(
        "Missing times",
        "Please set at least one timer before continuing."
      );
      return;
    }

    await saveJSON("gameSettings", cleaned);
    await appendHistory(cleaned);
    router.push("/game-settings/add-player");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </Pressable>
            <Text style={[styles.heading, { color: theme.text }]}>Game Settings</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={[styles.description, { color: theme.muted }]}>
            Adjust period and substitution intervals before tip-off.
          </Text>

          <View
            style={[styles.section, { backgroundColor: theme.section, borderColor: theme.border }]}
          >
            <View style={styles.gamePlan}>
              <Ionicons name="people-outline" size={20} color={theme.accent} />
              <Text style={styles.gamePlanLabel}>Game Plan</Text>
              <Text style={styles.gamePlanValue}>5 v 5</Text>
            </View>

            <View style={styles.infoRowInline}>
              <Ionicons
                name="time-outline"
                size={16}
                color={theme.accent}
                style={{ marginTop: 2 }}
              />
              <Text style={[styles.infoInlineText, { color: theme.muted }]}>
                Half-time is the longer mid-game reset. Quarter-time is an optional quick break each quarter.
              </Text>
            </View>

        <TimeSelectField
          label="Half Time"
          helper="Mid-game break after Q2"
          value={times.halfTime}
          options={HALF_OPTIONS}
          min={5}
          max={60}
          onChange={handleHalfChange}
        />

            <View style={styles.divider} />

            <View style={styles.quarterBlock}>
              <View style={styles.quarterCopy}>
                <Text style={styles.labelStrong}>Quarter Break</Text>
                <Text style={[styles.helperMuted, { color: theme.muted }]}>
                  Automatically half of your half-time. Toggle off if quarters aren’t used.
                </Text>
              </View>
              <Pressable
                style={[styles.quarterToggle, times.quarterTime > 0 && styles.quarterToggleActive]}
                onPress={toggleQuarter}
              >
                <Ionicons
                  name={times.quarterTime > 0 ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={times.quarterTime > 0 ? theme.accent : theme.muted}
                />
                <Text
                  style={[
                    styles.quarterValue,
                    { color: times.quarterTime > 0 ? theme.accent : theme.muted },
                  ]}
                >
                  {times.quarterTime > 0 ? `${times.quarterTime} min` : "Off"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

          <TimeSelectField
            label="Auto Sub Interval"
            helper="Minutes between auto sub rotations"
            value={times.subsTime}
            options={SUB_OPTIONS}
            min={1}
            max={15}
            onChange={handleSubsChange}
          />
          </View>

          <View style={styles.actions}>
            <ActionPill
              label="Reset"
              icon="refresh"
              onPress={resetToDefaults}
              textColor={theme.text}
              bgColor={theme.section}
            />
            <ActionPill
              label="Confirm"
              icon="checkmark"
              onPress={confirm}
              textColor="#FFFFFF"
              bgColor={theme.accent}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function normalizeTimes(values: Partial<StoredSettings>): StoredSettings {
  const normalizedHalf = clampToRange(
    Number(values.halfTime ?? DEFAULT_SETTINGS.halfTime),
    5,
    60
  );
  const quarterEnabled = Number(values.quarterTime ?? DEFAULT_SETTINGS.quarterTime) > 0;
  return {
    halfTime: normalizedHalf,
    quarterTime: quarterEnabled ? deriveQuarter(normalizedHalf) : 0,
    subsTime: clampToRange(
      Number(values.subsTime ?? DEFAULT_SETTINGS.subsTime),
      1,
      15
    ),
  };
}

function deriveQuarter(halfMinutes: number) {
  if (halfMinutes <= 10) {
    return clampToRange(Math.round(halfMinutes / 2), 1, 12);
  }
  if (halfMinutes <= 18) {
    return 8;
  }
  if (halfMinutes <= 24) {
    return 10;
  }
  const derived = Math.round(halfMinutes / 2);
  return clampToRange(derived, 12, 20);
}

function clampToRange(minutes: number, min: number, max: number) {
  if (!Number.isFinite(minutes)) return min;
  const rounded = Math.round(minutes);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

async function appendHistory(entry: StoredSettings) {
  const history =
    (await loadJSON<SettingsHistoryEntry[]>("gameSettingsHistory", [])) || [];
  const snapshot: SettingsHistoryEntry = {
    ...entry,
    savedAt: new Date().toISOString(),
  };
  await saveJSON("gameSettingsHistory", [snapshot, ...history].slice(0, 100));
}

type ActionProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  textColor: string;
  bgColor: string;
};

function ActionPill({ label, icon, onPress, textColor, bgColor }: ActionProps) {
  return (
    <Pressable style={[styles.pill, { backgroundColor: bgColor }]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={textColor} style={{ marginRight: 6 }} />
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
    fontSize: 15,
    lineHeight: 20,
  },
  section: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    gap: 20,
  },
  gamePlan: {
    backgroundColor: "rgba(37,99,235,0.08)",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gamePlanLabel: {
    fontSize: 14,
    color: "#2563EB",
    fontWeight: "600",
  },
  gamePlanValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  infoRowInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoInlineText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  quarterBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  quarterCopy: {
    flex: 1,
    gap: 4,
  },
  labelStrong: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  helperMuted: {
    fontSize: 13,
    lineHeight: 18,
  },
  quarterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.15)",
    backgroundColor: "#FFFFFF",
  },
  quarterToggleActive: {
    borderColor: "rgba(37,99,235,0.35)",
    backgroundColor: "rgba(37,99,235,0.1)",
  },
  quarterValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  pillText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
