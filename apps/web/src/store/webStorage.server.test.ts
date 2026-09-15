/**
 * @jest-environment node
 */
import { webStorage } from "./webStorage";

/**
 * The server half of the adapter, which the jsdom suite cannot reach: there is
 * always a `window` there. Both routes here are deliberate rather than
 * defensive — a read with no browser behind it has "nothing stored" as its
 * honest answer, and a *write* with nowhere to put it must not look like it
 * succeeded.
 */
describe("webStorage during server rendering", () => {
  it("answers a read with null rather than throwing", () => {
    expect(webStorage.getItem("brelly-pending-merge")).toBeNull();
  });

  it("refuses a write instead of silently dropping it", () => {
    expect(() => webStorage.setItem("brelly-pending-merge", "{}")).toThrow(
      /must run client-side/,
    );
  });

  it("treats a removal as already done", () => {
    expect(() => webStorage.removeItem("brelly-pending-merge")).not.toThrow();
  });
});
