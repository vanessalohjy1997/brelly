# `src/platform/` — the mobile half of the `@brelly/platform/*` seams

`packages/core` holds the logic both apps share. Where that logic needs
something only a platform can provide, it imports a bare specifier that **no
package publishes**:

```ts
import { db, doc, setDoc } from "@brelly/platform/firestore";
```

Each app resolves those specifiers in its own `tsconfig.json` `paths`, to its
own directory of implementations — this one for Expo, and `apps/web/src/platform`
for Next. One declaration is read by all three consumers that matter: `tsc`,
Metro (which honours tsconfig paths natively) and Jest (`jest-expo`'s
`withTypescriptMapping`).

The rule the seam list is derived from is **alias for behaviour, inject for
values**. A seam exists where the two platforms do the same thing by different
means. A value that merely differs — a key, a base URL — is not a seam; it goes
through `configureCore()`, because `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` are
literal bundler substitutions that no alias can bridge.

Core is never compiled on its own. It is compiled inside each app's project, so
an implementation here that drifts from what core imports fails this app's
`tsc --noEmit` — which is why there is no hand-maintained contract interface to
keep in step.
