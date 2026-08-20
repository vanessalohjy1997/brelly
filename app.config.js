// EAS Build only uploads files tracked by git, and the two Firebase config
// files are gitignored on purpose: this repo is public and they carry real
// project identifiers. So on EAS they arrive as `file`-type environment
// variables instead, whose value at build time is the path to the uploaded
// file — exactly what `googleServicesFile` already expects.
//
// `app.json` stays the source of truth for everything else; it just cannot
// read `process.env`, which is the only reason this dynamic config exists.
// Locally the vars are unset and the checked-out paths in `app.json` win.

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_INFO_PLIST ?? config.ios?.googleServicesFile,
  },
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
