import { useCallback, useState } from "react";

import {
  exportSlotsToCalendar,
  readImportableEvents,
  resolveEventLocation,
} from "@/services/calendar";
import { useItineraryStore } from "@/store/itineraryStore";
import { showToast } from "@/store/toastStore";
import { toDateKey } from "@/utils/dateKeys";
import {
  isAlreadyPlanned,
  summarizeExport,
  summarizeImport,
  type ImportOutcome,
} from "@/utils/calendarSync";
import { splitPlansByTime } from "@/utils/splitPlansByTime";

const PERMISSION_MESSAGE =
  "Brelly needs calendar access. You can grant it in system settings.";

/**
 * Moving plans between Brelly and the device calendar, in both directions.
 *
 * The two halves are deliberately manual buttons rather than a background
 * sync. A sync needs a shared identity for every event and a rule for what
 * happens when both sides changed; a copy needs neither, and "I pressed the
 * button" is a far easier model to be right about than "something happened
 * overnight and now there are two of everything".
 *
 * Unlike `useRoutineMaterializer`, this never reads `getState()` from a mount
 * effect — only from an explicit button press — so it's never exposed to the
 * cold-boot empty-state window the materialiser had to be gated for.
 */
export function useCalendarSync() {
  const plans = useItineraryStore((state) => state.plans);
  const addSlot = useItineraryStore((state) => state.addSlot);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportUpcoming = useCallback(async () => {
    setIsExporting(true);
    try {
      // Upcoming only. The archive is a record of what happened, and copying
      // last month into someone's calendar is not what "export my plans" means.
      const { upcoming } = splitPlansByTime(
        useItineraryStore.getState().plans,
        new Date(),
      );
      const slots = upcoming.flatMap((plan) => plan.slots);

      const written = await exportSlotsToCalendar(slots);
      if (written === null) {
        showToast(PERMISSION_MESSAGE, "error");
        return;
      }
      showToast(summarizeExport(written));
    } catch {
      showToast("Couldn't write to your calendar", "error");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const importUpcoming = useCallback(async () => {
    setIsImporting(true);
    try {
      const events = await readImportableEvents();
      if (events === null) {
        showToast(PERMISSION_MESSAGE, "error");
        return;
      }

      const outcome: ImportOutcome = {
        imported: 0,
        duplicates: 0,
        unresolved: 0,
      };

      for (const event of events) {
        // Re-read the store each time rather than closing over `plans`: two
        // calendar events at the same title and time would otherwise both
        // pass the duplicate check and both be added.
        if (isAlreadyPlanned(useItineraryStore.getState().plans, event)) {
          outcome.duplicates += 1;
          continue;
        }

        const place = await resolveEventLocation(event.location);
        if (!place) {
          outcome.unresolved += 1;
          continue;
        }

        addSlot(toDateKey(event.startDate), {
          label: event.title,
          location: place.location,
          latitude: place.latitude,
          longitude: place.longitude,
          startTime: event.startDate.toISOString(),
          endTime: event.endDate.toISOString(),
        });
        outcome.imported += 1;
      }

      showToast(
        summarizeImport(outcome),
        outcome.imported === 0 && outcome.unresolved > 0 ? "error" : "success",
      );
    } catch {
      showToast("Couldn't read your calendar", "error");
    } finally {
      setIsImporting(false);
    }
  }, [addSlot]);

  return {
    exportUpcoming,
    importUpcoming,
    isExporting,
    isImporting,
    // Nothing to export is worth knowing before pressing the button, so the
    // screen can say so instead of offering an action that does nothing.
    hasUpcoming:
      splitPlansByTime(plans, new Date()).upcoming.length > 0,
  };
}
