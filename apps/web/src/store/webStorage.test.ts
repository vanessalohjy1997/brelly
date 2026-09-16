import { webStorage } from "./webStorage";

beforeEach(() => {
  window.localStorage.clear();
});

describe("webStorage", () => {
  it("round-trips a value and reports a missing key as null", () => {
    expect(webStorage.getItem("brelly-pending-merge")).toBeNull();

    webStorage.setItem("brelly-pending-merge", '{"anonUid":"anon-1"}');
    expect(webStorage.getItem("brelly-pending-merge")).toBe(
      '{"anonUid":"anon-1"}',
    );

    webStorage.removeItem("brelly-pending-merge");
    expect(webStorage.getItem("brelly-pending-merge")).toBeNull();
  });

  it("lets a failed write reach the caller instead of swallowing it", () => {
    // The pending-merge record is written immediately before a destructive
    // delete, and `QuotaExceededError` in Safari's private mode is exactly the
    // situation in which losing it matters. A caught-and-ignored write would
    // turn a refusal to start into a delete with no way back.
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });

    expect(() => webStorage.setItem("k", "v")).toThrow("quota");

    setItem.mockRestore();
  });
});
