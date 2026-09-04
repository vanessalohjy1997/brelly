const appConfig = require('./app.config');
const appJson = require('./app.json');

const baseConfig = () => ({
  name: 'brelly',
  slug: 'brelly',
  ios: {
    bundleIdentifier: 'com.sg.brelly.app',
    googleServicesFile: './GoogleService-Info.plist',
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.sg.brelly.app',
    googleServicesFile: './google-services.json',
  },
});

describe('app.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_SERVICES_INFO_PLIST;
    delete process.env.GOOGLE_SERVICES_JSON;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('keeps the checked-out paths when the EAS file vars are unset', () => {
    const config = appConfig({ config: baseConfig() });

    expect(config.ios.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(config.android.googleServicesFile).toBe('./google-services.json');
  });

  it('prefers the EAS-uploaded paths when the file vars are set', () => {
    process.env.GOOGLE_SERVICES_INFO_PLIST = '/var/eas/GoogleService-Info.plist';
    process.env.GOOGLE_SERVICES_JSON = '/var/eas/google-services.json';

    const config = appConfig({ config: baseConfig() });

    expect(config.ios.googleServicesFile).toBe(
      '/var/eas/GoogleService-Info.plist'
    );
    expect(config.android.googleServicesFile).toBe(
      '/var/eas/google-services.json'
    );
  });

  it('overrides each platform independently', () => {
    process.env.GOOGLE_SERVICES_INFO_PLIST = '/var/eas/GoogleService-Info.plist';

    const config = appConfig({ config: baseConfig() });

    expect(config.ios.googleServicesFile).toBe(
      '/var/eas/GoogleService-Info.plist'
    );
    expect(config.android.googleServicesFile).toBe('./google-services.json');
  });

  it('leaves the rest of each platform block, and the top level, untouched', () => {
    const config = appConfig({ config: baseConfig() });

    expect(config.name).toBe('brelly');
    expect(config.slug).toBe('brelly');
    expect(config.ios.bundleIdentifier).toBe('com.sg.brelly.app');
    expect(config.ios.config).toEqual({ usesNonExemptEncryption: false });
    expect(config.android.package).toBe('com.sg.brelly.app');
  });

  it('does not throw when a platform block is absent', () => {
    expect(() => appConfig({ config: { name: 'brelly' } })).not.toThrow();
    expect(appConfig({ config: { name: 'brelly' } }).ios.googleServicesFile).
      toBeUndefined();
  });

  // The tab bar is a native UITabBar that iOS 26 styles as translucent Liquid
  // Glass on its own — content bleeds through and the icons lose contrast. The
  // per-bar props that would opt out (blurEffect, disableTransparentOnScrollEdge)
  // are no-ops on iOS 26 per the v57 native-tabs docs, so this app-wide flag is
  // the only lever that forces an opaque bar there. Assert it here so it can't
  // be dropped from app.json silently — a removal reintroduces the bleed-through
  // with a green suite.
  it('opts the whole app out of Liquid Glass on iOS 26', () => {
    expect(appJson.expo.ios.infoPlist.UIDesignRequiresCompatibility).toBe(true);
  });

  // The iOS purpose string is what App Review reads beside the location
  // dialog, and a review rejection turned on its wording: it has to say the
  // app works without location and that the read is scoped to while the app is
  // open. `app.json` can't carry a comment, so the requirement lives here.
  it('tells App Review location is optional, and scopes it to while the app is open', () => {
    const [, options] = appJson.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location'
    );

    expect(options.locationWhenInUsePermission).toMatch(/optional/i);
    expect(options.locationWhenInUsePermission).toMatch(/while the app is open/i);
    // The two things it is actually used for, and nothing else.
    expect(options.locationWhenInUsePermission).toMatch(/prefill/i);
    expect(options.locationWhenInUsePermission).toMatch(/nearby weather/i);
  });

  // The plugin defaults both of these to the placeholder "Allow
  // $(PRODUCT_NAME) to access your location" and writes them into Info.plist,
  // so a build declared two Always-location purpose strings for an API the app
  // never calls — it only ever requests foreground location, and nothing in
  // `expo-location`'s pod calls `requestAlwaysAuthorization` either, so
  // deleting them cannot trip Apple's binary scan. `false` deletes the key
  // outright (@expo/config-plugins ios/Permissions.js `applyPermissions`).
  // Asserted here because the cost of losing it is a reviewer asking why a
  // weather app wants your location in the background.
  it('declares no purpose string for a permission the app never requests', () => {
    const [, options] = appJson.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location'
    );

    expect(options.locationAlwaysAndWhenInUsePermission).toBe(false);
    expect(options.locationAlwaysPermission).toBe(false);
  });

  // Motion is the one that cannot be deleted, and it was — the upload came
  // back as ITMS-90683 "Missing purpose string in Info.plist". Apple scans the
  // *binary*, not the code paths: `expo-location` imports CoreMotion and calls
  // `CMMotionActivityManager` in `MotionActivityStreamer.swift`, which is
  // compiled in whether or not any JS reaches it. A referenced sensitive API
  // with no `NSMotionUsageDescription` fails processing, so the key has to be
  // there. The wording is the honest one: it says the app does not use motion,
  // because it does not, and a reviewer who sees the key deserves that answer.
  it('keeps a motion purpose string, because the binary links CoreMotion', () => {
    const [, options] = appJson.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location'
    );

    expect(typeof options.motionUsagePermission).toBe('string');
    expect(options.motionUsagePermission).toMatch(/does not use motion/i);
  });

  it('carries the Liquid Glass opt-out through the config merge', () => {
    const config = appConfig({ config: appJson.expo });

    expect(config.ios.infoPlist.UIDesignRequiresCompatibility).toBe(true);
  });
});
