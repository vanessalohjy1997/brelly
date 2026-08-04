import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Calendar from "expo-calendar";

import { useCalendarSync } from "@/hooks/useCalendarSync";
import { getPlaceDetails, searchPlaces } from "@/services/geocoding";
import { useItineraryStore } from "@/store/itineraryStore";
import { useToastStore } from "@/store/toastStore";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { toDateKey } from "@/utils/dateKeys";

jest.mock("@/services/geocoding", () => ({
  searchPlaces: jest.fn(),
  getPlaceDetails: jest.fn(),
}));

const getPermissions = Calendar.getCalendarPermissions as jest.Mock;
const requestPermissions = Calendar.requestCalendarPermissions as jest.Mock;
const getCalendars = Calendar.getCalendars as jest.Mock;
const listEvents = Calendar.listEvents as jest.Mock;
const mockSearchPlaces = searchPlaces as jest.Mock;
const mockGetPlaceDetails = getPlaceDetails as jest.Mock;

const createEvent = jest.fn();
const writableCalendar = { id: "cal-1", allowsModifications: true, createEvent };

/** A stop `days` from now, at midday. */
function slot(id: string, label: string, days: number): ItinerarySlot {
  const start = new Date();
  start.setDate(start.getDate() + days);
  start.setHours(12, 0, 0, 0);

  return {
    id,
    label,
    location: "East Coast Park, Singapore",
    neaRegion: "east",
    latitude: 1.3,
    longitude: 103.9,
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
  };
}

function dayPlan(days: number, slots: ItinerarySlot[]): DayPlan {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return { id: `p${days}`, date: toDateKey(date), slots };
}

/** A calendar event `days` from now, at 9am. */
function calendarEvent(id: string, title: string, days: number) {
  const start = new Date();
  start.setDate(start.getDate() + days);
  start.setHours(9, 0, 0, 0);

  return {
    id,
    title,
    location: "One Raffles Place",
    startDate: start,
    endDate: new Date(start.getTime() + 60 * 60 * 1000),
    allDay: false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useItineraryStore.setState({ plans: [] });
  useToastStore.setState({ toast: null, modalHosts: [] });
  getPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  requestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  getCalendars.mockResolvedValue([writableCalendar]);
  listEvents.mockResolvedValue([]);
  createEvent.mockResolvedValue({ id: "event-1" });
  mockSearchPlaces.mockResolvedValue([{ placeId: "p1" }]);
  mockGetPlaceDetails.mockResolvedValue({
    displayName: "One Raffles Place, Singapore",
    latitude: 1.2843,
    longitude: 103.8514,
  });
});

describe("useCalendarSync — export", () => {
  it("writes every upcoming stop out", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(1, [slot("a", "Beach run", 1), slot("b", "Lunch", 1)])],
    });
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.exportUpcoming();
    });

    expect(createEvent).toHaveBeenCalledTimes(2);
    expect(useToastStore.getState().toast?.message).toBe(
      "Added 2 plans to your calendar",
    );
  });

  it("leaves the archive out of it", async () => {
    // Copying last month into someone's calendar is not what "export my
    // plans" means.
    useItineraryStore.setState({
      plans: [
        dayPlan(-3, [slot("old", "Last week's lunch", -3)]),
        dayPlan(1, [slot("a", "Beach run", 1)]),
      ],
    });
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.exportUpcoming();
    });

    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Beach run" }),
    );
  });

  it("says permission is the problem rather than reporting a successful export of nothing", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("a", "Beach run", 1)])] });
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.exportUpcoming();
    });

    expect(createEvent).not.toHaveBeenCalled();
    expect(useToastStore.getState().toast).toMatchObject({ variant: "error" });
  });

  it("keeps going when one event is rejected, and counts what landed", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(1, [slot("a", "Beach run", 1), slot("b", "Lunch", 1)])],
    });
    createEvent
      .mockRejectedValueOnce(new Error("read-only"))
      .mockResolvedValueOnce({ id: "event-2" });
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.exportUpcoming();
    });

    expect(useToastStore.getState().toast?.message).toBe(
      "Added 1 plan to your calendar",
    );
  });

  it("offers nothing to export when there is nothing ahead", async () => {
    const { result } = await renderHook(() => useCalendarSync());

    expect(result.current.hasUpcoming).toBe(false);
  });
});

describe("useCalendarSync — import", () => {
  it("turns an event into a stop, with coordinates looked up from its location", async () => {
    // A calendar stores free text; a stop needs a lat/lng, because that is
    // what picks the nearest NEA area.
    listEvents.mockResolvedValue([calendarEvent("e1", "Standup", 1)]);
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.importUpcoming();
    });

    const plans = useItineraryStore.getState().plans;
    expect(plans).toHaveLength(1);
    expect(plans[0].slots[0]).toMatchObject({
      label: "Standup",
      location: "One Raffles Place, Singapore",
      latitude: 1.2843,
      longitude: 103.8514,
    });
  });

  it("does not import the same event twice", async () => {
    listEvents.mockResolvedValue([calendarEvent("e1", "Standup", 1)]);
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.importUpcoming();
    });
    await act(async () => {
      await result.current.importUpcoming();
    });

    expect(useItineraryStore.getState().plans[0].slots).toHaveLength(1);
    expect(useToastStore.getState().toast?.message).toBe(
      "Everything in your calendar is already planned",
    );
  });

  it("reports an event whose location can't be found instead of dropping it silently", async () => {
    listEvents.mockResolvedValue([calendarEvent("e1", "Standup", 1)]);
    mockSearchPlaces.mockResolvedValue([]);
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.importUpcoming();
    });

    expect(useItineraryStore.getState().plans).toHaveLength(0);
    expect(useToastStore.getState().toast?.message).toContain(
      "couldn't find",
    );
  });

  it("skips an all-day event, which has no start time to forecast against", async () => {
    listEvents.mockResolvedValue([
      { ...calendarEvent("e1", "Public holiday", 1), allDay: true },
    ]);
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.importUpcoming();
    });

    expect(useItineraryStore.getState().plans).toHaveLength(0);
    expect(useToastStore.getState().toast?.message).toBe(
      "No upcoming events with a location to import",
    );
  });

  it("says permission is the problem rather than reporting an empty calendar", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.importUpcoming();
    });

    expect(useToastStore.getState().toast).toMatchObject({ variant: "error" });
    expect(listEvents).not.toHaveBeenCalled();
  });

  it("prompts when there is still a prompt to show", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.importUpcoming();
    });

    expect(requestPermissions).toHaveBeenCalled();
  });

  it("clears its busy flag even when the read blows up", async () => {
    listEvents.mockRejectedValue(new Error("provider died"));
    const { result } = await renderHook(() => useCalendarSync());

    await act(async () => {
      await result.current.importUpcoming();
    });

    await waitFor(() => expect(result.current.isImporting).toBe(false));
    expect(useToastStore.getState().toast).toMatchObject({ variant: "error" });
  });
});
