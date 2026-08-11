jest.mock('expo/config-plugins', () => ({
  withDangerousMod: jest.fn(),
}));

const { patchPodfile } = require('./withFirebaseCoreSpmLink');

// The shape the Expo template generates, trimmed to what the anchor needs.
const PODFILE = `target 'brelly' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(installer)
  end
end
`;

describe('patchPodfile', () => {
  it('appends a post_integrate hook that re-runs the RNFirebase linking', () => {
    const patched = patchPodfile(PODFILE);

    expect(patched).toContain('post_integrate do |installer|');
    expect(patched).toContain('rnfirebase_add_spm_core_to_app_target(installer)');
  });

  it('guards the call so a Podfile without RNFirebase loaded still installs', () => {
    expect(patchPodfile(PODFILE)).toContain(
      'respond_to?(:rnfirebase_add_spm_core_to_app_target, true)',
    );
  });

  it('puts the hook at top level, outside the target block', () => {
    const lines = patchPodfile(PODFILE).split('\n');

    const hookLine = lines.findIndex((l) => l.startsWith('post_integrate do'));
    const targetEnd = lines.findIndex((l) => l === 'end');

    expect(hookLine).toBeGreaterThan(targetEnd);
  });

  it('is idempotent, so a re-prebuild does not stack the hook', () => {
    const once = patchPodfile(PODFILE);

    expect(patchPodfile(once)).toBe(once);
  });

  it('throws when the anchor is gone rather than silently doing nothing', () => {
    expect(() => patchPodfile("target 'brelly' do\n")).toThrow(
      /no top-level `end`/,
    );
  });
});
