import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, router } from "expo-router";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadJSON } from "../../lib/storage";

const DEFAULT_SETTINGS = {
  halfTime: 18,
  quarterTime: 8,
  subsTime: 4,
};

const ONGOING_GAME_KEY = "ongoingGameState";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Ezy Subs</Text>
          <Text style={styles.subtitle}>Coach Dashboard</Text>
          <Text style={styles.blurb}>
            Set your plan, select your roster, and stay ahead of every rotation.
          </Text>
        </View>

        <Image
          source={require("../../assets/images/home-basketball.png")}
          style={styles.hero}
          resizeMode="contain"
        />

        <Link asChild href="/onboarding">
          <Pressable style={styles.helpLink} hitSlop={10}>
            <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
            <Text style={styles.helpText}>View Instructions</Text>
          </Pressable>
        </Link>

        <View style={styles.buttons}>
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={handleStartNewGame}
            android_ripple={{ color: "rgba(255,255,255,0.2)" }}
          >
            <Text style={styles.primaryText}>Start New Game</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.outline]}
            onPress={handleLastGamePress}
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          >
            <Text style={styles.outlineText}>Last Game</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.history]}
            onPress={() => router.push("/team-statistic")}
            android_ripple={{ color: "rgba(37,99,235,0.08)" }}
            hitSlop={10}
          >
            <Ionicons
              name="stats-chart"
              size={18}
              color="#1E3A8A"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.historyText}>Game History</Text>
          </Pressable>
        </View>
      </View>
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
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 24,
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: "Righteous",
    fontSize: 44,
    color: "#111827",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
  },
  blurb: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
  },
  hero: {
    width: "90%",
    height: 240,
  },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  helpText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  buttons: {
    width: "100%",
    alignItems: "center",
    gap: 18,
  },
  button: {
    width: "90%",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primary: {
    backgroundColor: "#2563EB",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  outline: {
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  outlineText: {
    color: "#2563EB",
    fontSize: 18,
    fontWeight: "600",
  },
  history: {
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.18)",
    backgroundColor: "rgba(37,99,235,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  historyText: {
    color: "#1E3A8A",
    fontSize: 17,
    fontWeight: "600",
  },
});
