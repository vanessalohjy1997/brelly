import {
  resolveSlotKind,
  SLOT_KIND_HINTS,
  SLOT_KIND_LABELS,
  SLOT_KINDS,
} from "@/utils/slotKind";

describe("resolveSlotKind", () => {
  it("reads an untagged stop as outdoor", () => {
    // Every slot stored before the tag existed, and every calendar import,
    // arrives here — so this is the answer that decides whether adding the
    // field changed anyone's alerts. It must not.
    expect(resolveSlotKind(undefined)).toBe("outdoor");
  });

  it("passes a tagged stop through unchanged", () => {
    expect(resolveSlotKind("indoor")).toBe("indoor");
    expect(resolveSlotKind("outdoor")).toBe("outdoor");
  });
});

describe("the slot kinds", () => {
  it("offers outdoor first, because that is the default", () => {
    expect(SLOT_KINDS).toEqual(["outdoor", "indoor"]);
  });

  it("has a label and a hint for every kind", () => {
    // A `Record` keyed by the union already forces this at compile time; the
    // test is here for the values, since an empty string would satisfy the type
    // and render as a chip with no text on it.
    for (const kind of SLOT_KINDS) {
      expect(SLOT_KIND_LABELS[kind].length).toBeGreaterThan(0);
      expect(SLOT_KIND_HINTS[kind].length).toBeGreaterThan(0);
    }
  });

  it("says in the indoor hint that alerts start off", () => {
    // The chip silently moves the Rain alerts switch below it. The hint is the
    // only thing on screen that says so before it happens.
    expect(SLOT_KIND_HINTS.indoor).toMatch(/alerts start off/);
  });
});
