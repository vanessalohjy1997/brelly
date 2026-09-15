import { fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { CopyToDateAction } from "@/components/itinerary/CopyToDateAction";
import { Spacing } from "@/constants/theme";
import { renderWithProviders } from "@/test/renderWithProviders";
import {
  DatePickerWidth,
  DateTimePickerHeight,
} from "@brelly/core";

describe("CopyToDateAction", () => {
  it("duplicates to the date shown in the picker", async () => {
    const onDuplicate = jest.fn();
    const view = await renderWithProviders(
      <CopyToDateAction onDuplicate={onDuplicate} />,
    );

    const target = new Date(2026, 8, 20);
    await fireEvent(view.getByTestId("datetime-picker-date"), "valueChange", target);
    await fireEvent.press(view.getByText("Duplicate"));

    expect(onDuplicate).toHaveBeenCalledWith(target);
  });

  it("opens on tomorrow, so the common case is one press", async () => {
    const view = await renderWithProviders(
      <CopyToDateAction onDuplicate={jest.fn()} />,
    );

    const shown: Date = view.getByTestId("datetime-picker-date").props.value;
    const expected = new Date();
    expected.setDate(expected.getDate() + 1);

    expect(shown.toDateString()).toBe(expected.toDateString());
  });

  // The reported bug: caption, picker and button were a flat `Spacing.two`
  // apart, so three rows sat equally spaced with nothing saying which two were
  // one field. The ladder is what carries that, so it is what's asserted —
  // tighter inside the field than between the field and its button. The inner
  // value is `SlotForm`'s own `field` gap on purpose: this renders *inside*
  // that form, so anything else reads as the form losing its rhythm halfway
  // down.
  it("groups the caption with its picker more tightly than with the button", async () => {
    const view = await renderWithProviders(
      <CopyToDateAction onDuplicate={jest.fn()} />,
    );

    const picker = view.getByTestId("datetime-picker-date");
    const fieldGap = StyleSheet.flatten(picker.parent?.props.style).gap;
    const sectionGap = StyleSheet.flatten(
      picker.parent?.parent?.props.style,
    ).gap;

    expect(fieldGap).toBe(Spacing.one);
    expect(sectionGap).toBe(Spacing.three);
    expect(fieldGap).toBeLessThan(sectionGap);
  });

  // Both halves of the picker-box workaround — see `DateTimePickerHeight`. A
  // dropped `height` puts the capsule back to floating over the caption, and
  // that failure is invisible in a snapshot.
  it("pins the picker box so the capsule can't float or centre itself", async () => {
    const view = await renderWithProviders(
      <CopyToDateAction onDuplicate={jest.fn()} />,
    );

    expect(
      StyleSheet.flatten(view.getByTestId("datetime-picker-date").props.style),
    ).toMatchObject({
      width: DatePickerWidth,
      height: DateTimePickerHeight,
    });
  });
});
