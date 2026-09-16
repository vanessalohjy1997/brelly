import { cancelAllNotifications } from "./notifications";

describe("cancelAllNotifications on the web", () => {
  it("resolves, because there is no queue to clear", async () => {
    // Core's `signOutOfAccount` awaits this in the middle of an ordering that
    // matters. A seam missing on one platform would put that branch back into
    // core, which is the thing the boundary exists to prevent.
    await expect(cancelAllNotifications()).resolves.toBeUndefined();
  });
});
