import { fireEvent } from "@testing-library/react-native";

import {
  defaultStartTime,
  SlotForm,
  type SlotFormValues,
} from "@/components/itinerary/SlotForm";
import { renderWithProviders } from "@/test/renderWithProviders";
import { toDateKey } from "@/utils/dateKeys";

const INITIAL: SlotFormValues = {
  label: "Lunch with Sam",
  location: "Tanjong Pagar, Singapore",
  latitude: 1.2766,
  longitude: 103.8456,
  startTime: new Date(2026, 6, 31, 12, 30).toISOString(),
  endTime: new Date(2026, 6, 31, 13, 30).toISOString(),
};

describe("SlotForm", () => {
  it("submits the edited values", async () => {
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(
      view.getByDisplayValue("Lunch with Sam"),
      "Lunch with Alex",
    );
    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Lunch with Alex" }),
    );
  });

  it("refuses to submit without a label", async () => {
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(view.getByDisplayValue("Lunch with Sam"), "   ");
    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.getByText("Give this plan a label")).toBeTruthy();
  });

  it("refuses to submit a location that wasn't picked from the list", async () => {
    // Typing over the location clears the selected place — without
    // coordinates there's no NEA area to look a forecast up against.
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(
      view.getByDisplayValue("Tanjong Pagar, Singapore"),
      "Somewhere I typed",
    );
    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.getByText("Pick a location from the list")).toBeTruthy();
  });

  it("submits with rain alerts on by default", async () => {
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notificationsMuted: false }),
    );
  });

  it("submits a mute when rain alerts are switched off for this stop", async () => {
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SlotForm submitLabel="Save" initialValues={INITIAL} onSubmit={onSubmit} />,
    );

    await fireEvent(
      view.getByLabelText("Rain alerts for this stop"),
      "valueChange",
      false,
    );
    await fireEvent.press(view.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notificationsMuted: true }),
    );
  });

  it("shows an existing mute as switched off", async () => {
    const view = await renderWithProviders(
      <SlotForm
        submitLabel="Save"
        initialValues={{ ...INITIAL, notificationsMuted: true }}
        onSubmit={jest.fn()}
      />,
    );

    expect(view.getByLabelText("Rain alerts for this stop").props.value).toBe(
      false,
    );
  });

  it("shows a delete action only when one is provided", async () => {
    const withoutDelete = await renderWithProviders(
      <SlotForm submitLabel="Add" onSubmit={jest.fn()} />,
    );
    expect(withoutDelete.queryByText("Delete plan")).toBeNull();

    const onDelete = jest.fn();
    const withDelete = await renderWithProviders(
      <SlotForm submitLabel="Save" onSubmit={jest.fn()} onDelete={onDelete} />,
    );
    await fireEvent.press(withDelete.getByText("Delete plan"));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("defaultStartTime", () => {
  it("defaults to the next whole hour today when no day is given", () => {
    const start = defaultStartTime();

    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getTime()).toBeGreaterThan(Date.now());
    expect(start.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("puts the next whole hour on the day the form was opened for", () => {
    const start = defaultStartTime("2026-08-05");

    expect(toDateKey(start)).toBe("2026-08-05");
    expect(start.getMinutes()).toBe(0);
  });

  it("doesn't roll over when today's day-of-month exceeds the target month", () => {
    // Setting the month before the day would push 31 Jan + February into March.
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 31, 10, 15));
    try {
      expect(toDateKey(defaultStartTime("2026-02-05"))).toBe("2026-02-05");
    } finally {
      jest.useRealTimers();
    }
  });

  it("falls back to today for a day it can't parse", () => {
    expect(toDateKey(defaultStartTime("not-a-date"))).toBe(
      toDateKey(new Date()),
    );
  });
});
