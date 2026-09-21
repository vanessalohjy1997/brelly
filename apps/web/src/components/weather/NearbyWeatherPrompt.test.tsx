import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NearbyWeatherPrompt } from "./NearbyWeatherPrompt";

describe("NearbyWeatherPrompt", () => {
  it.each(["granted", "checking"] as const)(
    "renders nothing while %s",
    (permission) => {
      const { container } = render(
        <NearbyWeatherPrompt permission={permission} onRequest={jest.fn()} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("explains before the browser asks", () => {
    // The prompt used to fire from a mount effect, so the system sheet appeared
    // with no explanation and a refusal removed the feature permanently.
    render(<NearbyWeatherPrompt permission="unprompted" onRequest={jest.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Weather where you are" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/only reads your location/i)).toBeInTheDocument();
  });

  it("asks when the button is pressed, not before", async () => {
    const onRequest = jest.fn();
    render(<NearbyWeatherPrompt permission="unprompted" onRequest={onRequest} />);

    expect(onRequest).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Turn on location" }),
    );
    expect(onRequest).toHaveBeenCalled();
  });

  it("names the browser's own control instead of offering a dead button", async () => {
    // The phone deep-links into Settings. A page cannot open the browser's
    // permission UI — it is the one control a site is not allowed to drive — so
    // there is no button here at all, and the copy says where the control is.
    render(<NearbyWeatherPrompt permission="denied" onRequest={jest.fn()} />);

    expect(screen.getByText(/padlock beside the address bar/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers a retry when the permission is held but no fix came back", () => {
    // A different failure from a refusal, and not one re-prompting would fix.
    render(<NearbyWeatherPrompt permission="unavailable" onRequest={jest.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Couldn't find you" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
