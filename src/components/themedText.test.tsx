import { render } from "@testing-library/react-native";
import { StyleSheet, type TextStyle } from "react-native";

import { ThemedText } from "@/components/themedText";

describe("ThemedText", () => {
  it("gives 'eyebrow' the small-caps look used for a card's own section heading", async () => {
    const view = await render(
      <ThemedText type="eyebrow">Right now</ThemedText>,
    );

    const style = StyleSheet.flatten(
      view.getByText("Right now").props.style,
    ) as TextStyle;
    expect(style).toMatchObject({
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    });
  });

  it("gives 'fieldLabel' the caption look used above a form field or a single action", async () => {
    const view = await render(
      <ThemedText type="fieldLabel">Location</ThemedText>,
    );

    const style = StyleSheet.flatten(
      view.getByText("Location").props.style,
    ) as TextStyle;
    expect(style).toMatchObject({
      fontSize: 12,
      fontWeight: 600,
      textTransform: "uppercase",
    });
  });
});
