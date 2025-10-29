import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function LaunchScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" />

      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.brand}>Ezy Subs</Text>
          <Text style={styles.tagline}>Own every substitution.</Text>
          <Text style={styles.subtitle}>
            Dialed-in rotations without the clipboard stress.
          </Text>
        </View>

        <View style={styles.heroBlock}>
          <Image
            source={require("../assets/images/launch-basketball-image.png")}
            resizeMode="contain"
            style={styles.heroImage}
          />

          <Pressable
            onPress={async () => {
              const seen = await AsyncStorage.getItem("hasOnboardedVersion");
              router.replace(seen ? "/home" : "/onboarding");
            }}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            android_ripple={{ color: "rgba(255,255,255,0.25)" }}
          >
            <Text style={styles.ctaText}>Get Started</Text>
          </Pressable>
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
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  headerBlock: {
    gap: 12,
  },
  brand: {
    fontFamily: "Righteous",
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -0.25,
    fontWeight: "400",
    color: "#212121",
  },
  tagline: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  heroBlock: {
    flex: 1,
    marginTop: 24,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  cta: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    backgroundColor: "#F97316",
    borderRadius: 999,
    paddingHorizontal: 44,
    paddingVertical: 14,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
