import { render, screen } from "@testing-library/react";

import { metadata as root } from "./layout";
import { metadata as today } from "./page";
import AccountLayout, { metadata as account } from "./account/layout";
import HistoryLayout, { metadata as history } from "./history/layout";
import EditLayout, { metadata as edit } from "./plan/[id]/layout";
import NewLayout, { metadata as add } from "./plan/new/layout";
import PlansLayout, { metadata as plans } from "./plans/layout";
import RoutinesLayout, { metadata as routines } from "./routines/layout";
import SettingsLayout, { metadata as settings } from "./settings/layout";

jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

/**
 * Every route names its tab. The pages are client components and cannot carry
 * `metadata`, and `document.title` loses to React 19's hoisted `<title>`, so
 * the name lives one level up in a server layout — this is the list that says
 * none was forgotten.
 */
describe("tab titles", () => {
  it("templates each route's name onto the app's", () => {
    expect(root.title).toEqual({ default: "Brelly", template: "%s · Brelly" });
  });

  it("names every route", () => {
    // The root segment's own page is the one the template does not reach.
    expect(today.title).toBe("Today · Brelly");
    expect(plans.title).toBe("Plans");
    expect(history.title).toBe("History");
    expect(settings.title).toBe("Settings");
    expect(routines.title).toBe("Routines");
    expect(account.title).toBe("Account");
    expect(add.title).toBe("Add plan");
    expect(edit.title).toBe("Edit plan");
  });

  it("renders the page through unchanged", () => {
    for (const Layout of [
      AccountLayout,
      HistoryLayout,
      EditLayout,
      NewLayout,
      PlansLayout,
      RoutinesLayout,
      SettingsLayout,
    ]) {
      const { unmount } = render(
        <Layout>
          <p>page</p>
        </Layout>,
      );
      expect(screen.getByText("page")).toBeInTheDocument();
      unmount();
    }
  });
});
