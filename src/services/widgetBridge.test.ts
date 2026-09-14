import { ExtensionStorage } from "@bacons/apple-targets";
import { Platform } from "react-native";

import {
  WIDGET_KIND,
  WIDGET_SNAPSHOT_KEY,
  writeWidgetSnapshot,
} from "@/services/widgetBridge";
import { type WidgetSnapshot } from "@brelly/core";

const setSpy = (ExtensionStorage as unknown as { setSpy: jest.Mock }).setSpy;
const reloadWidget = ExtensionStorage.reloadWidget as jest.Mock;

const snapshot: WidgetSnapshot = {
  generatedAt: "2026-07-31T00:00:00.000Z",
  next: {
    label: "Picnic",
    location: "East Coast Park, Singapore",
    startTime: "2026-07-31T08:00:00.000Z",
    forecastText: "Thundery Showers",
    temperature: { low: 26, high: 32 },
    umbrella: { needed: true, reason: "rain", shortLabel: "Rain" },
  },
};

function setPlatform(os: string) {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

describe("writeWidgetSnapshot", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform("ios");
  });

  afterEach(() => {
    setPlatform(originalOS);
  });

  it("serialises the snapshot into the shared key and reloads the widget", () => {
    writeWidgetSnapshot(snapshot);

    expect(setSpy).toHaveBeenCalledWith(
      WIDGET_SNAPSHOT_KEY,
      JSON.stringify(snapshot),
    );
    expect(reloadWidget).toHaveBeenCalledWith(WIDGET_KIND);
  });

  it("does nothing off iOS — there is no widget on Android", () => {
    setPlatform("android");

    writeWidgetSnapshot(snapshot);

    expect(setSpy).not.toHaveBeenCalled();
    expect(reloadWidget).not.toHaveBeenCalled();
  });

  it("swallows a write failure so the notification sync survives it", () => {
    setSpy.mockImplementationOnce(() => {
      throw new Error("no shared container");
    });

    expect(() => writeWidgetSnapshot(snapshot)).not.toThrow();
    // The reload never runs once the write threw, but the caller is unharmed.
    expect(reloadWidget).not.toHaveBeenCalled();
  });
});
