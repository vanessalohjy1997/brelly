import {
  configureCore,
  getCoreConfig,
  resetCoreConfig,
  type CoreConfig,
} from "./config";

const direct: CoreConfig = { places: { mode: "direct", apiKey: "test-key" } };

afterEach(() => {
  resetCoreConfig();
});

describe("configureCore", () => {
  it("hands back what the app entry point injected", () => {
    configureCore(direct);
    expect(getCoreConfig()).toEqual(direct);
  });

  it("takes the last call, so an app may reconfigure between sessions", () => {
    configureCore(direct);
    configureCore({
      places: { mode: "proxy", placesPath: "/api/places", geocodePath: "/api/places/geocode" },
    });
    expect(getCoreConfig().places).toEqual({
      mode: "proxy",
      placesPath: "/api/places",
      geocodePath: "/api/places/geocode",
    });
  });

  it("throws by name when read before the entry point configured it", () => {
    // The point of the throw: the module-scope `process.env.X!` this replaces
    // failed by interpolating `undefined` into a URL, and Google answered 400.
    // That reads as an API problem, not a build one.
    expect(() => getCoreConfig()).toThrow(/configureCore\(\) has not been called/);
  });
});
