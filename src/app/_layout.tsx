import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AnimatedSplashOverlay } from "@/components/animatedIcon";
import { useNotificationSync } from "@/hooks/useNotificationSync";
import { useAppColorScheme } from "@/hooks/useTheme";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // cache weather data for 10 minutes
      retry: 2,
    },
  },
});

export default function TabLayout() {
  const colorScheme = useAppColorScheme();
  // Mounted once, at the root: brings scheduled notifications back in line
  // with the current forecast on launch and on every return to the foreground.
  useNotificationSync();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <AnimatedSplashOverlay />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="plan/new"
              options={{ presentation: "modal", title: "Add plan" }}
            />
            <Stack.Screen
              name="plan/[id]"
              options={{ presentation: "modal", title: "Edit plan" }}
            />
            <Stack.Screen
              name="settings"
              options={{ presentation: "modal", title: "Settings" }}
            />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
