import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, router } from "expo-router";
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadJSON } from "../../lib/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Device type detection
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_WIDTH < 350;
const isShortDevice = SCREEN_HEIGHT < 700;
const isTablet = SCREEN_WIDTH >= 768;

// Responsive scaling helpers - clamped for extreme sizes
const scale = (size: number) => {
  const ratio = SCREEN_WIDTH / 375;
  const clamped = Math.max(0.85, Math.min(ratio, 1.3)); // Prevent extreme scaling
  return size * clamped;
};
const verticalScale = (size: number) => {
  const ratio = SCREEN_HEIGHT / 812;
  const clamped = Math.max(0.85, Math.min(ratio, 1.2));
  return size * clamped;
};
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const DEFAULT_SETTINGS = {
  halfTime: 18,
  quarterTime: 8,
  subsTime: 4,
};

const ONGOING_GAME_KEY = "ongoingGameState";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.container}>
          {/* Header Section */}
          <View style={styles.header}>
            <Text style={styles.title}>Ezy Subs</Text>
            <Text style={styles.subtitle}>Coach Dashboard</Text>
            <Text style={styles.blurb}>
              Set your plan, select your roster, and stay ahead of every
              rotation.
            </Text>
          </View>

          {/* Hero Image - Reduced size */}
          <View style={styles.heroContainer}>
            <Image
              source={require("../../assets/images/home-basketball.png")}
              style={styles.hero}
              resizeMode="contain"
            />
          </View>

          {/* Action Buttons - NEW HIERARCHY */}
          <View style={styles.buttons}>
            {/* PRIMARY ACTION - Start New Game */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleStartNewGame}
              android_ripple={{ color: "rgba(255,255,255,0.25)" }}
            >
              <View style={styles.primaryButtonContent}>
                <View style={styles.iconCircle}>
                  <Ionicons name="basketball" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.primaryText}>Start New Game</Text>
                  <Text style={styles.primarySubtext}>Begin fresh session</Text>
                </View>
              </View>
            </Pressable>

            {/* SECONDARY ACTIONS - Side by side */}
            <View style={styles.secondaryRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondary,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleLastGamePress}
                android_ripple={{ color: "rgba(37,99,235,0.08)" }}
              >
                <Ionicons name="refresh-outline" size={20} color="#2563EB" />
                <Text style={styles.secondaryText}>Continue</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondary,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => router.push("/team-statistic")}
                android_ripple={{ color: "rgba(37,99,235,0.08)" }}
              >
                <Ionicons name="stats-chart" size={20} color="#2563EB" />
                <Text style={styles.secondaryText}>History</Text>
              </Pressable>
            </View>
          </View>

          {/* Help Link - Moved to bottom */}
          <Link asChild href="/onboarding">
            <Pressable style={styles.helpLink} hitSlop={10}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#64748B"
              />
              <Text style={styles.helpText}>View Instructions</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function handleStartNewGame() {
  await AsyncStorage.removeItem(ONGOING_GAME_KEY);
  await AsyncStorage.removeItem("gameSettings");
  await AsyncStorage.setItem(
    "gameSettingsDefaults",
    JSON.stringify(DEFAULT_SETTINGS)
  );
  router.push("/game-settings/new-game");
}

type StoredGameSummary = {
  gameEnded?: boolean;
};

async function handleLastGamePress() {
  const persisted = await loadJSON<StoredGameSummary | null>(
    ONGOING_GAME_KEY,
    null
  );

  if (persisted && !persisted.gameEnded) {
    Alert.alert(
      "Unfinished game",
      "You have an unfinished game. Do you want to continue or end it?",
      [
        {
          text: "Continue",
          onPress: () => router.push("/game-court"),
        },
        {
          text: "End game",
          style: "destructive",
          onPress: () =>
            router.push({ pathname: "/game-court", params: { finalize: "1" } }),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
    return;
  }

  router.push("/game-settings/add-player");
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: isTinyDevice ? 16 : isSmallDevice ? 20 : 24,
    paddingVertical: Math.max(20, verticalScale(24)),
    paddingBottom: Math.max(28, verticalScale(32)),
    gap: isShortDevice ? verticalScale(20) : verticalScale(28),
    minHeight: SCREEN_HEIGHT - 100,
  },
  header: {
    alignItems: "center",
    gap: moderateScale(8),
    paddingHorizontal: isTinyDevice ? 8 : 16,
  },
  title: {
    fontFamily: Platform.select({
      ios: "System",
      android: "Roboto",
      default: "System",
    }),
    fontSize: isTinyDevice ? 32 : isSmallDevice ? 38 : moderateScale(44),
    color: "#111827",
    letterSpacing: -0.5,
    fontWeight: Platform.select({
      ios: "700",
      android: "bold",
      default: "700",
    }) as any,
    textAlign: "center",
  },
  subtitle: {
    fontSize: isTinyDevice ? 14 : moderateScale(16),
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
  },
  blurb: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: isTinyDevice ? 12 : moderateScale(14),
    lineHeight: isTinyDevice ? 17 : moderateScale(20),
    maxWidth: isTablet ? 400 : isTinyDevice ? SCREEN_WIDTH * 0.9 : 300,
    paddingHorizontal: 8,
  },
  heroContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical:
      SCREEN_HEIGHT < 700 ? verticalScale(12) : verticalScale(20),
  },
  hero: {
    width: isTinyDevice ? "75%" : isSmallDevice ? "80%" : "85%",
    height: isShortDevice ? verticalScale(160) : verticalScale(200),
    maxHeight: 240,
    maxWidth: isTablet ? 400 : undefined,
  },
  buttons: {
    width: "100%",
    alignItems: "center",
    gap: moderateScale(14),
    paddingTop: SCREEN_HEIGHT < 700 ? 0 : verticalScale(8),
  },
  button: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  // PRIMARY BUTTON (Start New Game)
  primary: {
    width: "100%",
    maxWidth: isTablet ? 500 : 400,
    backgroundColor: "#2563EB",
    paddingVertical: isTinyDevice ? 14 : moderateScale(18),
    paddingHorizontal: isTinyDevice ? 16 : moderateScale(20),
    minHeight: isTinyDevice ? 72 : 80,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(16),
    width: "100%",
  },
  iconCircle: {
    width: isTinyDevice ? 40 : moderateScale(48),
    height: isTinyDevice ? 40 : moderateScale(48),
    borderRadius: isTinyDevice ? 20 : moderateScale(24),
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  buttonTextContainer: {
    flex: 1,
    alignItems: "flex-start",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: isTinyDevice ? 17 : moderateScale(20),
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  primarySubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: isTinyDevice ? 11 : moderateScale(13),
    fontWeight: "500",
    marginTop: 2,
  },
  // SECONDARY ACTIONS ROW
  secondaryRow: {
    width: "100%",
    maxWidth: isTablet ? 500 : 400,
    flexDirection: "row",
    gap: isTinyDevice ? 10 : moderateScale(14),
  },
  secondary: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#2563EB",
    paddingVertical: isTinyDevice ? 12 : moderateScale(14),
    paddingHorizontal: isTinyDevice ? 8 : moderateScale(12),
    minHeight: isTinyDevice ? 60 : 64,
    gap: isTinyDevice ? 6 : 8,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  secondaryText: {
    color: "#2563EB",
    fontSize: moderateScale(14),
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  // HELP LINK
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: SCREEN_HEIGHT < 700 ? 0 : verticalScale(8),
  },
  helpText: {
    color: "#64748B",
    fontSize: moderateScale(13),
    fontWeight: "600",
  },
});
