import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SlotForm } from "@/components/itinerary/SlotForm";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { useItineraryStore } from "@/store/itineraryStore";

export default function NewSlotScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const addSlot = useItineraryStore((state) => state.addSlot);

  const planDate = date ?? new Date().toISOString().split("T")[0];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ThemedText type="linkPrimary">Cancel</ThemedText>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <SlotForm
          submitLabel="Add plan"
          onSubmit={(values) => {
            addSlot(planDate, values);
            router.back();
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}
