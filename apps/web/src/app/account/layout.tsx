import type { Metadata } from "next";

/** Names the tab; see the note on `metadata` in the root layout. */
export const metadata: Metadata = { title: "Account" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
