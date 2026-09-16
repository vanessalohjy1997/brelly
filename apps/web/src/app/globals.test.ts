import fs from "node:fs";
import path from "node:path";

import { compile } from "tailwindcss";

/**
 * The one test that compiles `globals.css` rather than reading it.
 *
 * `@theme { --spacing-*: initial }` is deliberate — it deletes `p-4` and every
 * other raw-value utility — but it deletes `--spacing` itself, which is the
 * base the *zero* utilities multiply too. Tailwind emits nothing for a class it
 * cannot resolve and says nothing about it, so `fixed inset-x-0 bottom-0` on
 * the mobile tab bar compiled to `position: fixed` with auto insets and put the
 * bar at the top of the page. Nothing in the type system, the linter or a
 * render test can see that: the class name is a string either way, and jsdom
 * has no Tailwind.
 *
 * So this asks Tailwind directly, for every `-0` class the app actually uses.
 */
const APP_DIR = __dirname;
const SRC_DIR = path.join(APP_DIR, "..");

/**
 * Where `tailwindcss`'s own stylesheets are, found through its *JavaScript*
 * entry point. `require.resolve("tailwindcss/index.css")` cannot be used and
 * neither can `createRequire`: `next/jest` maps every `.css` specifier to a
 * stub module, so both hand back `styleMock.js` and PostCSS then fails on
 * `"use strict"`.
 */
const TAILWIND_DIR = path.resolve(require.resolve("tailwindcss"), "../..");

/** Resolve `@import "tailwindcss"` and its own relative imports off disk. */
function loadStylesheet(id: string, base: string) {
  const file = id.startsWith(".")
    ? path.resolve(base, id)
    : path.join(TAILWIND_DIR, `${id.replace(/^tailwindcss/, "index")}.css`);
  return {
    base: path.dirname(file),
    content: fs.readFileSync(file, "utf8"),
    path: file,
  };
}

async function buildUtilities(candidates: string[]): Promise<string> {
  const compiler = await compile(
    fs.readFileSync(path.join(APP_DIR, "globals.css"), "utf8"),
    { base: APP_DIR, loadStylesheet: async (id, base) => loadStylesheet(id, base) },
  );
  return compiler.build(candidates);
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(full) && !/\.test\./.test(full) ? [full] : [];
  });
}

/** Every `…-0` class token that appears in a `className` in the app. */
function zeroUtilitiesInUse(): string[] {
  const found = new Set<string>();
  for (const file of sourceFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    for (const [, literal] of source.matchAll(/className=\{?["`]([^"`]*)["`]/g)) {
      for (const token of literal.split(/\s+/)) {
        if (/^[a-z][a-z-]*-0$/.test(token)) found.add(token);
      }
    }
  }
  return [...found].sort();
}

/** Tailwind emits `.p-0 {` — the class, escaped, followed by its block. */
function emits(css: string, utility: string): boolean {
  return css.includes(`.${utility} {`);
}

describe("globals.css", () => {
  it("compiles every zero utility the app uses", async () => {
    const utilities = zeroUtilitiesInUse();
    // A guard that finds nothing to guard has stopped guarding.
    expect(utilities.length).toBeGreaterThan(0);

    const css = await buildUtilities(utilities);
    expect(utilities.filter((utility) => !emits(css, utility))).toEqual([]);
  });

  it("still has no raw-value spacing scale", async () => {
    const css = await buildUtilities(["p-1", "p-4", "gap-2", "mt-8", "p-three"]);

    expect(emits(css, "p-1")).toBe(false);
    expect(emits(css, "p-4")).toBe(false);
    expect(emits(css, "gap-2")).toBe(false);
    expect(emits(css, "mt-8")).toBe(false);
    // The token scale is untouched by the zero key that makes the above pass.
    expect(emits(css, "p-three")).toBe(true);
  });
});
