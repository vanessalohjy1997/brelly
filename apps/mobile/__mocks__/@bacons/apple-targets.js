// Test double for the App-Group bridge. The real `ExtensionStorage` is backed
// by an iOS-only native module (reached through the `expo` global) that has no
// implementation in the Jest environment, so importing it for real throws at
// module load. This stands in and records calls so `widgetBridge`'s
// serialisation can be asserted. A `__mocks__` directory adjacent to
// `node_modules` is applied to node modules automatically — no `jest.mock`
// call is needed (and one with a factory that required this file would make
// the resolver recurse into itself).

const setSpy = jest.fn();

class ExtensionStorage {
  constructor(appGroup) {
    this.appGroup = appGroup;
  }

  set(key, value) {
    return setSpy(key, value);
  }

  get() {
    return null;
  }

  remove() {}
}

ExtensionStorage.reloadWidget = jest.fn();
ExtensionStorage.reloadControls = jest.fn();

// Exposed so a test can assert what `set` was called with — every instance's
// `set` delegates here, since the bridge constructs a fresh instance per call.
ExtensionStorage.setSpy = setSpy;

module.exports = { ExtensionStorage };
