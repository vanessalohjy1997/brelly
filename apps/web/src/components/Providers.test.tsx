import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";

import { getCoreConfig } from "@brelly/core";

import { Providers } from "./Providers";

function ReportClient({ onClient }: { onClient: (client: QueryClient) => void }) {
  onClient(useQueryClient());
  return null;
}

function mountAndCaptureClient(): QueryClient {
  let captured!: QueryClient;
  const view = render(
    <Providers>
      <ReportClient onClient={(client) => (captured = client)} />
    </Providers>,
  );
  view.unmount();
  return captured;
}

describe("Providers", () => {
  it("configures core for the proxy, holding no Places key", () => {
    // The web half of "alias for behaviour, inject for values". A key here
    // would be inlined into the browser bundle by Next and defeat the proxy
    // entirely — which is why the config is a union with no `apiKey` field on
    // this arm to fill in wrongly.
    const { places } = getCoreConfig();

    expect(places).toEqual({
      mode: "proxy",
      placesPath: "/api/places",
      geocodePath: "/api/places/geocode",
    });
    expect(places).not.toHaveProperty("apiKey");
  });

  it("gives each mount its own QueryClient", () => {
    // On the server, where one Node process serves every visitor, a shared
    // client is one user's cached plans handed to the next. A module-scope
    // client — which is what the phone has, correctly — would fail this.
    expect(mountAndCaptureClient()).not.toBe(mountAndCaptureClient());
  });

  it("keeps the client stable across re-renders", () => {
    const seen: QueryClient[] = [];
    const view = render(
      <Providers>
        <ReportClient onClient={(client) => seen.push(client)} />
      </Providers>,
    );
    view.rerender(
      <Providers>
        <ReportClient onClient={(client) => seen.push(client)} />
      </Providers>,
    );

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it("caches weather for ten minutes and retries twice", () => {
    // The same defaults the phone's root layout sets. Weather is expensive and
    // slow-moving; a default `staleTime` of 0 would refetch every mount.
    const defaults = mountAndCaptureClient().getDefaultOptions().queries;
    expect(defaults).toMatchObject({ staleTime: 600_000, retry: 2 });
  });
});
