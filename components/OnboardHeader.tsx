// components/OnboardHeader.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  step: number; // 1-based
  total: number; // e.g., 5
};

export default function OnboardHeader({ step, total }: Props) {
  return (
    <View style={styles.wrap}>
      {/* “Instructions” pill */}
      <View style={styles.pill}>
        <Text style={styles.pillText}>Instructions</Text>
      </View>

      {/* Step dots + label */}
      <View style={styles.progressRow}>
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => {
            const active = i + 1 === step;
            return (
              <View key={i} style={[styles.dot, active && styles.dotActive]} />
            );
          })}
        </View>
        <Text style={styles.stepText}>
          Step {step} of {total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 8,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF6FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#CFE6FF",
  },
  pillText: {
    color: "#0B5FFF",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  dotActive: {
    width: 18,
    height: 7,
    borderRadius: 6,
    backgroundColor: "#0B5FFF",
  },
  stepText: {
    color: "#6B7280",
    fontSize: 12,
  },
});
