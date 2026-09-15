import path from "node:path";

import type { NextConfig } from "next";

/**
 * `transpilePackages` is not optional here. `@brelly/core` is a workspace
 * package whose `main` is TypeScript *source* (`src/index.ts`) rather than a
 * built `dist/`, and Next compiles nothing under `node_modules` — which is
 * where Yarn's workspace symlink puts it — unless the package is named here.
 * Without it the first `import { … } from "@brelly/core"` fails on the first
 * `type` keyword it meets.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@brelly/core"],
  // Next infers the tracing root from where it finds a lockfile and warns when
  // that is not the app directory. In a workspace it never is — the only
  // lockfile is the repo's, deliberately, and a second one inside `apps/web`
  // would break `yarn install --frozen-lockfile` at the root (CI greps for
  // exactly that). Saying so explicitly also keeps `@brelly/core` inside the
  // traced file set, which the deploy in Phase 4 depends on.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // `next build` runs its own ESLint pass, and it cannot see this repo's flat
  // config — that lives at the root, where the other two workspaces are linted
  // from the same file. The result is a warning about a missing Next plugin
  // that is in fact configured, one directory up. `yarn lint` is the gate, and
  // it covers `apps/web` with the Next rules; this turns off the duplicate.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
