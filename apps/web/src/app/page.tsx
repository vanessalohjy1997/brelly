import type { Metadata } from "next";

// Spelled out: the root layout's template applies to child segments only,
// and this page sits in the root segment itself.
export const metadata: Metadata = { title: "Today · Brelly" };

// The screen itself is a client component, in `today.tsx`. This file exists so
// the route can carry a title — see the note on `metadata` in `layout.tsx`.
export { default } from "./today";
