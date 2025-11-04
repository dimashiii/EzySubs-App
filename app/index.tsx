import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Device type detection
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_WIDTH < 350;
const isShortDevice = SCREEN_HEIGHT < 700;
const isTablet = SCREEN_WIDTH >= 768;

// Responsive scaling helper - clamped for extreme sizes
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

export default function LaunchScreen() {
  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom", "left", "right"]}
    >
      <StatusBar style="dark" />

      <View style={styles.container}>
        {/* Header Block - Fixed at top */}
        <View style={styles.headerBlock}>
          <Text style={styles.brand}>Ezy Subs</Text>
          <Text style={styles.tagline}>Own every substitution.</Text>
          <Text style={styles.subtitle}>
            Dialed-in rotations without the clipboard stress.
          </Text>
        </View>

        {/* Hero Block - Image fills remaining space */}
        <View style={styles.heroBlock}>
          <Image
            source={require("../assets/images/launch-basketball-image.png")}
            resizeMode="cover"
            style={styles.heroImage}
          />

          {/* CTA Button - Overlaid on image */}
          <View style={styles.ctaOverlay}>
            <Pressable
              onPress={async () => {
                const seen = await AsyncStorage.getItem("hasOnboardedVersion");
                router.replace(seen ? "/home" : "/onboarding");
              }}
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
              ]}
              android_ripple={{ color: "rgba(255,255,255,0.25)" }}
            >
              <Text style={styles.ctaText}>Get Started</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
  },
  headerBlock: {
    paddingHorizontal: isTinyDevice ? 16 : isSmallDevice ? 20 : 28,
    paddingTop: Platform.select({
      ios: Math.max(32, verticalScale(40)),
      android: Math.max(28, verticalScale(32)),
      default: 48,
    }),
    paddingBottom: verticalScale(20),
    gap: moderateScale(12),
    backgroundColor: "#FFFFFF",
    zIndex: 10,
  },
  brand: {
    fontFamily: Platform.select({
      ios: "System",
      android: "Roboto",
      default: "System",
    }),
    fontSize: isTinyDevice ? 32 : isSmallDevice ? 38 : moderateScale(48),
    lineHeight: isTinyDevice ? 42 : isSmallDevice ? 48 : moderateScale(64),
    letterSpacing: -0.25,
    fontWeight: Platform.select({
      ios: "700",
      android: "bold",
      default: "700",
    }) as any,
    color: "#212121",
  },
  tagline: {
    fontSize: isTinyDevice ? 16 : moderateScale(20),
    lineHeight: isTinyDevice ? 22 : moderateScale(28),
    fontWeight: "700",
    color: "#2563EB",
  },
  subtitle: {
    fontSize: isTinyDevice ? 13 : moderateScale(15),
    lineHeight: isTinyDevice ? 18 : moderateScale(22),
    color: "#475569",
    maxWidth: isTablet ? 400 : "90%",
  },
  heroBlock: {
    flex: 1,
    position: "relative",
    width: "100%",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  ctaOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.select({
      ios: Math.max(28, verticalScale(32)),
      android: Math.max(36, verticalScale(40)),
      default: 32,
    }),
    paddingHorizontal: isTinyDevice ? 16 : isSmallDevice ? 20 : 28,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    backgroundColor: "#F97316",
    borderRadius: 999,
    paddingHorizontal: isTinyDevice ? 36 : moderateScale(44),
    paddingVertical: isTinyDevice ? 12 : moderateScale(14),
    minWidth: isTinyDevice
      ? SCREEN_WIDTH * 0.65
      : isSmallDevice
      ? SCREEN_WIDTH * 0.6
      : SCREEN_WIDTH * 0.5,
    maxWidth: isTablet ? 350 : SCREEN_WIDTH * 0.85,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52, // Ensure touch target
    // Enhanced shadow for visibility on image
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: isTinyDevice ? 16 : moderateScale(18),
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
  },
});
