jest.mock('expo/config-plugins', () => ({
  // Hand the mod straight back so the test can run it against a fake project.
  withXcodeProject: (config, mod) => mod(config),
}));

const withExplicitModulesDisabled = require('./withExplicitModulesDisabled');

const buildConfig = (section) => ({
  modResults: {
    pbxXCBuildConfigurationSection: () => section,
  },
});

describe('withExplicitModulesDisabled', () => {
  it('disables both explicit-module settings on every build configuration', () => {
    const section = {
      AAA: { buildSettings: { PRODUCT_NAME: 'brelly' } },
      BBB: { buildSettings: { SWIFT_ENABLE_EXPLICIT_MODULES: 'YES' } },
    };

    withExplicitModulesDisabled(buildConfig(section));

    expect(section.AAA.buildSettings).toEqual({
      PRODUCT_NAME: 'brelly',
      CLANG_ENABLE_EXPLICIT_MODULES: 'NO',
      SWIFT_ENABLE_EXPLICIT_MODULES: 'NO',
    });
    expect(section.BBB.buildSettings).toEqual({
      CLANG_ENABLE_EXPLICIT_MODULES: 'NO',
      SWIFT_ENABLE_EXPLICIT_MODULES: 'NO',
    });
  });

  it('skips the `_comment` string entries the section is interleaved with', () => {
    const section = {
      AAA: { buildSettings: {} },
      AAA_comment: 'Debug',
    };

    expect(() => withExplicitModulesDisabled(buildConfig(section))).not.toThrow();
    expect(section.AAA_comment).toBe('Debug');
  });

  it('skips entries that carry no build settings', () => {
    const section = { AAA: {} };

    expect(() => withExplicitModulesDisabled(buildConfig(section))).not.toThrow();
    expect(section.AAA).toEqual({});
  });

  it('returns the config so it can be chained', () => {
    const config = buildConfig({});

    expect(withExplicitModulesDisabled(config)).toBe(config);
  });
});
