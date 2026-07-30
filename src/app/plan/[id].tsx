import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SlotForm } from "@/components/itinerary/SlotForm";
import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useItineraryStore } from "@/store/itineraryStore";

export default function EditSlotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useItineraryStore((state) => state.findSlotById(id));
  const updateSlot = useItineraryStore((state) => state.updateSlot);
  const deleteSlot = useItineraryStore((state) => state.deleteSlot);

  if (!found) {
    return (
      <ThemedView style={styles.missing}>
        <ThemedText>This plan no longer exists.</ThemedText>
      </ThemedView>
    );
  }

  const { date, slot } = found;

  const handleDelete = () => {
    Alert.alert(
      "Delete plan",
      `Remove "${slot.label}" from your itinerary?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteSlot(date, slot.id);
            router.back();
          },
        },
      ],
    );
  };

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
          submitLabel="Save changes"
          initialValues={{
            label: slot.label,
            location: slot.location,
            latitude: slot.latitude,
            longitude: slot.longitude,
            startTime: slot.startTime,
            endTime: slot.endTime,
          }}
          onSubmit={(values) => {
            updateSlot(date, slot.id, values);
            router.back();
          }}
          onDelete={handleDelete}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
});
