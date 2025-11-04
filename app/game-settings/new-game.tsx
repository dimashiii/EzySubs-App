import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TimeSelectField from "../../components/TimeSelectField";
import { loadJSON, saveJSON } from "../../lib/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Device type detection
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_WIDTH < 350;
const isShortDevice = SCREEN_HEIGHT < 700;
const isTablet = SCREEN_WIDTH >= 768;

// Responsive scaling helpers - clamped for extreme sizes
const scale = (size: number) => {
  const ratio = SCREEN_WIDTH / 375;
  const clamped = Math.max(0.85, Math.min(ratio, 1.3));
  return size * clamped;
};
const verticalScale = (size: number) => {
  const ratio = SCREEN_HEIGHT / 812;
  const clamped = Math.max(0.85, Math.min(ratio, 1.2));
  return size * clamped;
};
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

type StoredSettings = {
  halfTime: number;
  quarterTime: number;
  subsTime: number;
};

type SettingsHistoryEntry = StoredSettings & {
  savedAt: string;
};

const DEFAULT_SETTINGS = Object.freeze({
  halfTime: 18,
  quarterTime: 8,
  subsTime: 4,
});

// QUICK PRESETS - Age-based for parent coaches
const PRESETS = {
  u10: {
    name: "U10",
    halfTime: 15,
    quarterTime: 0,
    subsTime: 3,
    icon: "people" as const,
  },
  u12: {
    name: "U12",
    halfTime: 18,
    quarterTime: 8,
    subsTime: 4,
    icon: "basketball" as const,
  },
  u14: {
    name: "U14",
    halfTime: 20,
    quarterTime: 10,
    subsTime: 5,
    icon: "trophy" as const,
  },
  practice: {
    name: "Practice",
    halfTime: 12,
    quarterTime: 0,
    subsTime: 2,
    icon: "fitness" as const,
  },
};

const HALF_OPTIONS = [5, 8, 10, 12, 15, 18, 20, 24, 30, 40, 45, 50, 60];
const SUB_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12, 15];

export default function NewGame() {
  const router = useRouter();
  const [times, setTimes] = useState<StoredSettings>({ ...DEFAULT_SETTINGS });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

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
    setSelectedPreset(null);
  };

  const handleSubsChange = (minutes: number) => {
    setTimes((prev) => ({
      ...prev,
      subsTime: clampToRange(minutes, 1, 15),
    }));
    setSelectedPreset(null);
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
    setSelectedPreset(null);
  };

  const resetToDefaults = () => {
    setTimes(normalizeTimes(DEFAULT_SETTINGS));
    setSelectedPreset(null);
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey as keyof typeof PRESETS];
    setTimes({
      halfTime: preset.halfTime,
      quarterTime: preset.quarterTime,
      subsTime: preset.subsTime,
    });
    setSelectedPreset(presetKey);
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

  // Calculated values
  const totalGameTime = times.halfTime * 2;
  const subsPerHalf =
    times.subsTime > 0 ? Math.floor(times.halfTime / times.subsTime) : 0;
  const estimatedTotal = totalGameTime + 5;

  // Smart tips
  const getSubsTip = () => {
    if (subsPerHalf >= 6) return "Frequent subs keep everyone energized";
    if (subsPerHalf <= 2) return "Less subs - make sure everyone plays fair";
    return `Everyone rotates ${subsPerHalf}× per half`;
  };

  const getGameTip = () => {
    if (totalGameTime <= 20) return "Quick game - perfect for younger kids";
    if (totalGameTime >= 40) return "Full length game";
    return "Standard youth game length";
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.bg }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.screen}>
          <View style={styles.content}>
            {/* Header Row */}
            <View style={styles.topRow}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
                hitSlop={10}
              >
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </Pressable>
              <Text style={[styles.heading, { color: theme.text }]}>
                Game settings
              </Text>
              <Pressable
                onPress={resetToDefaults}
                hitSlop={10}
                style={styles.resetInline}
              >
                <Ionicons name="refresh" size={14} color={theme.accent} />
                {!isTinyDevice && (
                  <Text
                    style={[styles.resetInlineText, { color: theme.accent }]}
                  >
                    Reset
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetsContainer}>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <Pressable
                  key={key}
                  onPress={() => applyPreset(key)}
                  style={({ pressed }) => [
                    styles.presetButton,
                    selectedPreset === key && styles.presetButtonActive,
                    pressed && styles.presetButtonPressed,
                  ]}
                >
                  <Ionicons
                    name={preset.icon}
                    size={isTinyDevice ? 14 : 16}
                    color={selectedPreset === key ? "#2563EB" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.presetText,
                      selectedPreset === key && styles.presetTextActive,
                    ]}
                  >
                    {preset.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Game Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="time-outline" size={16} color={theme.accent} />
                <Text style={styles.summaryTitle}>Game Overview</Text>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalGameTime}</Text>
                  <Text style={styles.summaryLabel}>Play Time</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{estimatedTotal}</Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{subsPerHalf}</Text>
                  <Text style={styles.summaryLabel}>Subs</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {times.quarterTime > 0 ? "4" : "2"}
                  </Text>
                  <Text style={styles.summaryLabel}>Periods</Text>
                </View>
              </View>
            </View>

            {/* Settings Section */}
            <View
              style={[
                styles.section,
                { backgroundColor: theme.section, borderColor: theme.border },
              ]}
            >
              <TimeSelectField
                label="Half length"
                helper="How long is each half?"
                value={times.halfTime}
                options={HALF_OPTIONS}
                min={5}
                max={60}
                onChange={handleHalfChange}
              />
              <View style={styles.smartTip}>
                <Ionicons name="bulb-outline" size={12} color="#F59E0B" />
                <Text style={styles.smartTipText}>{getGameTip()}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.quarterRow}>
                <View style={styles.quarterCopy}>
                  <Text style={styles.labelStrong}>Quarter breaks</Text>
                  <Text style={[styles.helperMuted, { color: theme.muted }]}>
                    Split each half into two quarters
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.quarterToggle,
                    times.quarterTime > 0 && styles.quarterToggleActive,
                  ]}
                  onPress={toggleQuarter}
                >
                  <Ionicons
                    name={
                      times.quarterTime > 0
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={isTinyDevice ? 14 : 16}
                    color={times.quarterTime > 0 ? theme.accent : theme.muted}
                  />
                  <Text
                    style={[
                      styles.quarterValue,
                      {
                        color:
                          times.quarterTime > 0 ? theme.accent : theme.muted,
                      },
                    ]}
                  >
                    {times.quarterTime > 0 ? `${times.quarterTime}m` : "Off"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.divider} />

              <TimeSelectField
                label="Auto subs"
                helper="Swap players every X minutes"
                value={times.subsTime}
                options={SUB_OPTIONS}
                min={1}
                max={15}
                onChange={handleSubsChange}
              />
              <View style={styles.smartTip}>
                <Ionicons name="bulb-outline" size={12} color="#F59E0B" />
                <Text style={styles.smartTipText}>{getSubsTip()}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <ActionPill
              label="Cancel"
              icon="close"
              onPress={() => router.back()}
              textColor={theme.text}
              bgColor={theme.section}
            />
            <ActionPill
              label="Continue"
              icon="arrow-forward"
              onPress={confirm}
              textColor="#FFFFFF"
              bgColor={theme.accent}
            />
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

function normalizeTimes(values: Partial<StoredSettings>): StoredSettings {
  const normalizedHalf = clampToRange(
    Number(values.halfTime ?? DEFAULT_SETTINGS.halfTime),
    5,
    60
  );
  const quarterEnabled =
    Number(values.quarterTime ?? DEFAULT_SETTINGS.quarterTime) > 0;
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
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: bgColor },
        pressed && styles.pillPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
      <Ionicons
        name={icon}
        size={isTinyDevice ? 14 : 16}
        color={textColor}
        style={{ marginLeft: 6 }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: isTinyDevice ? 18 : isSmallDevice ? 22 : 24,
    paddingTop: Platform.select({
      ios: Math.max(16, verticalScale(20)),
      android: Math.max(20, verticalScale(24)),
      default: 20,
    }),
    paddingBottom: Math.max(20, verticalScale(24)),
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: isShortDevice ? 14 : 18,
  },
  backButton: {
    width: isTinyDevice ? 38 : 40,
    height: isTinyDevice ? 38 : 40,
    borderRadius: isTinyDevice ? 19 : 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    flexShrink: 0,
  },
  heading: {
    fontSize: isTinyDevice ? 19 : isSmallDevice ? 21 : moderateScale(23),
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  resetInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: isTinyDevice ? 10 : 12,
    paddingVertical: isTinyDevice ? 6 : 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(37,99,235,0.24)",
    flexShrink: 0,
  },
  resetInlineText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
  },
  // PRESETS
  presetsContainer: {
    flexDirection: "row",
    gap: isTinyDevice ? 6 : 8,
    marginBottom: isShortDevice ? 14 : 18,
    justifyContent: "space-between",
  },
  presetButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: isTinyDevice ? 2 : 3,
    paddingVertical: isTinyDevice ? 9 : 11,
    paddingHorizontal: isTinyDevice ? 3 : 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(100,116,139,0.3)",
    backgroundColor: "#FFFFFF",
  },
  presetButtonActive: {
    borderColor: "#2563EB",
    backgroundColor: "rgba(37,99,235,0.08)",
  },
  presetButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  presetText: {
    fontSize: isTinyDevice ? 10 : moderateScale(11),
    fontWeight: "600",
    color: "#64748B",
  },
  presetTextActive: {
    color: "#2563EB",
  },
  // SUMMARY CARD
  summaryCard: {
    marginBottom: isShortDevice ? 14 : 18,
    backgroundColor: "rgba(37,99,235,0.06)",
    borderRadius: 12,
    padding: isTinyDevice ? 10 : 12,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.15)",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: isTinyDevice ? 12 : moderateScale(13),
    fontWeight: "700",
    color: "#0F172A",
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: isTinyDevice ? 5 : 7,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: isTinyDevice ? 9 : 11,
    paddingHorizontal: 2,
  },
  summaryValue: {
    fontSize: isTinyDevice ? 16 : moderateScale(18),
    fontWeight: "700",
    color: "#2563EB",
  },
  summaryLabel: {
    fontSize: isTinyDevice ? 8.5 : moderateScale(9.5),
    fontWeight: "600",
    color: "#64748B",
    marginTop: 3,
    textAlign: "center",
  },
  // SMART TIPS
  smartTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -7,
    paddingHorizontal: 2,
  },
  smartTipText: {
    fontSize: isTinyDevice ? 9.5 : moderateScale(10.5),
    color: "#92400E",
    fontWeight: "500",
    flex: 1,
  },
  section: {
    borderRadius: 14,
    paddingVertical: isTinyDevice ? 12 : 14,
    paddingHorizontal: isTinyDevice ? 12 : 14,
    borderWidth: 1,
    gap: isTinyDevice ? 11 : 13,
    maxWidth: isTablet ? 600 : undefined,
    alignSelf: "center",
    width: "100%",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(15,23,42,0.08)",
    width: "100%",
  },
  quarterRow: {
    flexDirection: isSmallDevice ? "column" : "row",
    alignItems: isSmallDevice ? "flex-start" : "center",
    justifyContent: "space-between",
    gap: isSmallDevice ? 10 : 12,
  },
  quarterCopy: {
    flex: 1,
    gap: 2,
  },
  labelStrong: {
    fontSize: isTinyDevice ? 13 : moderateScale(14),
    fontWeight: "700",
    color: "#0F172A",
  },
  helperMuted: {
    fontSize: isTinyDevice ? 10 : moderateScale(10.5),
    lineHeight: isTinyDevice ? 14 : 15,
  },
  quarterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: isTinyDevice ? 7 : 9,
    paddingHorizontal: isTinyDevice ? 12 : 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.15)",
    backgroundColor: "#FFFFFF",
    alignSelf: isSmallDevice ? "flex-start" : "auto",
    minWidth: isTinyDevice ? 65 : 75,
    justifyContent: "center",
  },
  quarterToggleActive: {
    borderColor: "rgba(37,99,235,0.35)",
    backgroundColor: "rgba(37,99,235,0.08)",
  },
  quarterValue: {
    fontSize: isTinyDevice ? 12 : moderateScale(13),
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: isTinyDevice ? 10 : 12,
    paddingTop: isShortDevice ? 14 : 18,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: isTinyDevice ? 11 : moderateScale(13),
    paddingHorizontal: isTinyDevice ? 16 : moderateScale(20),
    minHeight: 48,
    maxWidth: isTablet ? 280 : undefined,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  pillPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  pillText: {
    fontSize: isTinyDevice ? 13 : moderateScale(14),
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
