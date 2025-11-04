import OnboardDots from "@/components/OnboardDots";
import OnboardSlide from "@/components/OnboardSlide";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ONBOARDING_VERSION = "v1";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Device type detection
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_WIDTH < 350;
const isShortDevice = SCREEN_HEIGHT < 700;
const isTablet = SCREEN_WIDTH >= 768;

// Responsive scaling helpers
const moderateScale = (size: number, factor = 0.5) => {
  const ratio = SCREEN_WIDTH / 375;
  const clamped = Math.max(0.85, Math.min(ratio, 1.3));
  return size + (size * clamped - size) * factor;
};

const slides = [
  {
    key: "add-players",
    title: "Add Players",
    body: "Quickly add or search players, then select who joins today's game.",
    image: require("../../assets/onboarding/instruction1.png"),
  },
  {
    key: "game-settings",
    title: "Game Settings",
    body: "Set period length, fouls, and team preferences before you tip off.",
    image: require("../../assets/onboarding/instruction2.png"),
  },
  {
    key: "manage-on-court",
    title: "Manage on Court",
    body: "Drag and drop to substitute players without missing a beat.",
    image: require("../../assets/onboarding/instruction3.png"),
  },
  {
    key: "stay-in-control",
    title: "Stay in Control",
    body: "Keep an eye on timeouts, fouls, and player freshness in real time.",
    image: require("../../assets/onboarding/instruction4.png"),
  },
  {
    key: "track-performance",
    title: "Track Performance",
    body: "Review playtime and stats to optimize your rotation next game.",
    image: require("../../assets/onboarding/instruction5.png"),
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const markDone = async () => {
    await AsyncStorage.setItem("hasOnboardedVersion", ONBOARDING_VERSION);
    router.replace("/home");
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / SCREEN_WIDTH);
    setIndex(i);

    // Auto-enter app after last slide
    if (i === slides.length - 1) {
      setTimeout(markDone, 350);
    }
  };

  const handleSkip = () => {
    markDone();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          statusBarStyle: "dark",
          statusBarBackgroundColor: "#FFFFFF",
          statusBarTranslucent: false,
        }}
      />

      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.wrap}>
          {/* Skip Button - Top Right */}
          <View style={styles.skipContainer}>
            <Pressable
              onPress={handleSkip}
              hitSlop={10}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.skipButtonPressed,
              ]}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          {/* Slides ScrollView */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            scrollEventThrottle={16}
            decelerationRate="fast"
            contentContainerStyle={styles.scrollContent}
          >
            {slides.map((s) => (
              <View key={s.key} style={{ width: SCREEN_WIDTH }}>
                <OnboardSlide title={s.title} body={s.body} image={s.image} />
              </View>
            ))}
          </ScrollView>

          {/* Bottom Section - Dots Only */}
          <SafeAreaView edges={["bottom"]} style={styles.bottomSection}>
            <OnboardDots index={index} total={slides.length} />
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  wrap: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  skipContainer: {
    position: "absolute",
    right: isTinyDevice ? 12 : isSmallDevice ? 14 : 16,
    top: Platform.select({
      ios: isTinyDevice ? 8 : 12,
      android: isTinyDevice ? 12 : 16,
      default: 12,
    }),
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: isTinyDevice ? 8 : isSmallDevice ? 10 : 12,
    paddingVertical: isTinyDevice ? 5 : isSmallDevice ? 6 : 8,
    borderRadius: 8,
    minWidth: isTinyDevice ? 50 : 60,
    alignItems: "center",
  },
  skipButtonPressed: {
    opacity: 0.6,
  },
  skipText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: isTinyDevice ? 14 : moderateScale(16),
  },
  scrollContent: {
    flexGrow: 1,
  },
  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingVertical: isShortDevice ? 14 : isTinyDevice ? 16 : 20,
    minHeight: isShortDevice ? 70 : 80,
    alignItems: "center",
    justifyContent: "center",
  },
});
