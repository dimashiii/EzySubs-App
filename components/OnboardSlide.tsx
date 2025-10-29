import React from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";

const { height: H } = Dimensions.get("window");

type Props = {
  title: string;
  body: string;
  image: any; // require(...)
};

export default function OnboardSlide({ title, body, image }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Image source={image} style={styles.image} resizeMode="contain" />
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 48,
  },
  title: {
    fontFamily: "Righteous",
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.2,
    color: "#212121",
    textAlign: "center",
  },
  image: {
    width: "100%",
    maxWidth: 360,
    height: Math.min(H * 0.48, 380),
  },
  body: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    color: "#475569",
    paddingHorizontal: 8,
  },
});
