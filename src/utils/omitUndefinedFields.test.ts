import { omitUndefinedFields } from "@/utils/omitUndefinedFields";

describe("omitUndefinedFields", () => {
  it("drops keys whose value is undefined", () => {
    expect(omitUndefinedFields({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it("keeps falsy-but-defined values", () => {
    expect(omitUndefinedFields({ a: 0, b: "", c: false, d: null })).toEqual({
      a: 0,
      b: "",
      c: false,
      d: null,
    });
  });

  it("returns an equivalent object when nothing is undefined", () => {
    expect(omitUndefinedFields({ a: 1, b: "two" })).toEqual({
      a: 1,
      b: "two",
    });
  });

  it("does not mutate the input", () => {
    const input = { a: 1, b: undefined };

    omitUndefinedFields(input);

    expect(input).toEqual({ a: 1, b: undefined });
  });
});
