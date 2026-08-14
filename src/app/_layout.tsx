import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AnimatedSplashOverlay } from "@/components/animatedIcon";
import { ToastHost } from "@/components/toast";
import { BottomTabInset } from "@/constants/theme";
import { useCloudBootstrap } from "@/hooks/useCloudBootstrap";
import { useNotificationSync } from "@/hooks/useNotificationSync";
import { useRoutineSync } from "@/hooks/useRoutineMaterializer";
import { useAppColorScheme } from "@/hooks/useTheme";
import { configureGoogleSignIn } from "@/services/auth";

SplashScreen.preventAutoHideAsync();
configureGoogleSignIn();

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
  // Ensures a signed-in (possibly anonymous) uid exists, migrates settings
  // to Firestore once, and attaches the live settings listener — see
  // FIREBASE_MIGRATION.md phase 2. The return value isn't consumed here yet;
  // no screen needs the readiness flag until phases 3–4 give itinerary/
  // routine screens an empty state to distinguish from "not loaded".
  useCloudBootstrap();
  // Mounted once, at the root: fills in the next fortnight of every routine
  // before anything reads the itinerary, then brings scheduled notifications
  // back in line with the current forecast. Both re-run on every return to the
  // foreground; routines go first so the sync sees the stops they just added.
  useRoutineSync();
  useNotificationSync();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <AnimatedSplashOverlay />
          {/* `minimal` leaves the back chevron but drops its label, which
              would otherwise read as the previous screen's title (i.e. the
              tab name) on iOS. */}
          <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
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
              name="routines"
              options={{ presentation: "modal", title: "Routines" }}
            />
            <Stack.Screen
              name="account-link"
              options={{ presentation: "modal", title: "Back up your data" }}
            />
          </Stack>
          {/* After the Stack so it draws over the tab screens, and clear of
              the tab bar. Each modal above mounts its own — see `hosts` in
              the toast store for why one host here isn't enough. */}
          <ToastHost root bottomInset={BottomTabInset} />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
