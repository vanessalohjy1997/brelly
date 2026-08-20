const appConfig = require('./app.config');

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
});
