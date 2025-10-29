import OnboardDots from "@/components/OnboardDots";
import OnboardSlide from "@/components/OnboardSlide";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ONBOARDING_VERSION = 'v1';
const { width: SCREEN_W } = Dimensions.get("window");

const slides = [
  { key: "add-players", title: "Add Players", body: "Quickly add or search players, then select who joins today’s game.", image: require("../../assets/onboarding/instruction1.png") },
  { key: "game-settings", title: "Game Settings", body: "Set period length, fouls, and team preferences before you tip off.", image: require("../../assets/onboarding/instruction2.png") },
  { key: "manage-on-court", title: "Manage on Court", body: "Drag and drop to substitute players without missing a beat.", image: require("../../assets/onboarding/instruction3.png") },
  { key: "stay-in-control", title: "Stay in Control", body: "Keep an eye on timeouts, fouls, and player freshness in real time.", image: require("../../assets/onboarding/instruction4.png") },
  { key: "track-performance", title: "Track Performance", body: "Review playtime and stats to optimize your rotation next game.", image: require("../../assets/onboarding/instruction5.png") },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // ✅ Save the flag and go to /home
  const markDone = async () => {
    await AsyncStorage.setItem('hasOnboardedVersion', ONBOARDING_VERSION);
    router.replace('/home');
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / SCREEN_W);
    setIndex(i);

    // ✅ Auto-enter app after last slide
    if (i === slides.length - 1) {
      setTimeout(markDone, 350);
    }
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

          {/* (Optional) Skip button */}
          <View style={{ position: 'absolute', right: 16, top: 12, zIndex: 10 }}>
            <Pressable onPress={markDone} hitSlop={10}>
              <Text style={{ color: '#2563EB', fontWeight: '600', fontSize: 16 }}>
                Skip
              </Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
          >
            {slides.map((s) => (
              <View key={s.key} style={{ width: SCREEN_W, flex: 1 }}>
                <OnboardSlide title={s.title} body={s.body} image={s.image} />
              </View>
            ))}
          </ScrollView>

          {/* keep this ABOVE the gesture area */}
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#FFFFFF" }}>
            <OnboardDots index={index} total={slides.length} />
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  wrap: { flex: 1, backgroundColor: "#FFFFFF" },
});
