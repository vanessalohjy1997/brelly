import { openAppSettings } from "./appSettings";

describe("openAppSettings on the web", () => {
  it("reports that there is nowhere to go", async () => {
    // `false` is the answer every caller already handles — an Android ROM with
    // no settings activity produces it too — so no call site needs a web
    // branch. What each of them must change is the copy: "Settings › Brelly"
    // names nothing in a browser.
    await expect(openAppSettings()).resolves.toBe(false);
  });
});
