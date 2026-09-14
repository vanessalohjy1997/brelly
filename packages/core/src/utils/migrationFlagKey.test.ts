import { migrationFlagKey } from "./migrationFlagKey";

describe("migrationFlagKey", () => {
  it("scopes the flag to the uid, so signing into another account re-asks", () => {
    expect(migrationFlagKey("anon-1")).toBe("brelly-migration-complete:anon-1");
    expect(migrationFlagKey("anon-1")).not.toBe(migrationFlagKey("linked-2"));
  });
});
