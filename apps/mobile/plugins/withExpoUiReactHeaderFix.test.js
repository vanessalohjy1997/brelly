jest.mock('expo/config-plugins', () => ({
  withDangerousMod: jest.fn(),
}));

const { patchPodfile } = require('./withExpoUiReactHeaderFix');

// The shape the Expo template generates, trimmed to what the anchor needs.
const PODFILE = `target 'brelly' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

describe('patchPodfile', () => {
  it('adds the overlay and the -isystem it depends on, after react_native_post_install', () => {
    const patched = patchPodfile(PODFILE);

    expect(patched).toContain(
      '-ivfsoverlay $(PODS_ROOT)/React-Core-prebuilt/React-VFS.yaml',
    );
    // The overlay grafts a virtual `React/` dir onto this directory, so it is
    // useless without the directory itself being on the include path.
    expect(patched).toContain(
      '-isystem #{react_headers}',
    );
    expect(patched).toContain(
      "'$(PODS_ROOT)/React-Core-prebuilt/React.xcframework/Headers'",
    );
    expect(patched.indexOf('React-VFS.yaml')).toBeGreaterThan(
      patched.indexOf('react_native_post_install('),
    );
  });

  it('keeps the patch inside the post_install block', () => {
    const patched = patchPodfile(PODFILE);
    const lines = patched.split('\n');

    const patchLine = lines.findIndex((l) => l.includes('React-VFS.yaml'));
    const postInstallLine = lines.findIndex((l) => l.includes('post_install do'));
    const blockEnd = lines.findIndex((l) => l === 'end');

    expect(patchLine).toBeGreaterThan(postInstallLine);
    expect(patchLine).toBeLessThan(blockEnd);
  });

  it('is idempotent, so a re-prebuild does not stack the flag', () => {
    const once = patchPodfile(PODFILE);

    expect(patchPodfile(once)).toBe(once);
  });

  it('throws when the anchor is gone rather than silently doing nothing', () => {
    expect(() => patchPodfile("target 'brelly' do\nend\n")).toThrow(
      /react_native_post_install/,
    );
  });
});
