import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  index: number; // 0-based
  total: number;
};

export default function OnboardDots({ index, total }: Props) {
  const step = index + 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, i) => {
          const active = i === index;
          return (
            <View key={i} style={[styles.dot, active && styles.dotActive]} />
          );
        })}
      </View>
      <Text style={styles.label}>
        Instructions {step} of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 14,
    paddingBottom: 24, // sits above gesture/nav area; SafeArea added below too
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#2563EB",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#616161",
  },
});
