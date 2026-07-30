import { moveItem } from "@/utils/reorder";

describe("moveItem", () => {
  it("moves an item forward, shifting the ones in between back", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward, shifting the ones in between forward", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns the same order (new array) when from and to are equal", () => {
    const input = ["a", "b", "c"];
    expect(moveItem(input, 1, 1)).toEqual(["a", "b", "c"]);
  });

  it("clamps an out-of-range target index to the last valid index", () => {
    expect(moveItem(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
  });

  it("clamps a negative target index to the first valid index", () => {
    expect(moveItem(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
  });

  it("returns an empty array unchanged", () => {
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});
