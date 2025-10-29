import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function HomeTab() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.txt}>Home</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  txt: { fontSize: 18, color: "#222" },
});
