import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import "react-native-reanimated";

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,

          // Global status bar (applies to ALL screens by default)
          statusBarStyle: "dark", // dark icons/text (visible on white)
          statusBarBackgroundColor: "#FFFFFF", // solid white strip on Android
          statusBarTranslucent: false, // keep content below the bar
          animation: "fade",
        }}
      >
        {/* Launch first */}
        <Stack.Screen name="index" />
        {/* Tabs after you hit GO! */}
        <Stack.Screen name="(tabs)" />
        {/* Keep your modal if you use it */}
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
    </ThemeProvider>
  );
}
