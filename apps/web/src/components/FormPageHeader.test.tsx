import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FormPageHeader } from "./FormPageHeader";

const back = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ back: (...args: unknown[]) => back(...args) }),
}));

beforeEach(() => {
  back.mockClear();
});

describe("FormPageHeader", () => {
  it("names the page in its heading", () => {
    render(
      <FormPageHeader title="Add plan" confirmDiscard={async () => true} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Add plan" }),
    ).toBeInTheDocument();
  });

  it("goes back when there is nothing to discard", async () => {
    render(
      <FormPageHeader title="Add plan" confirmDiscard={async () => true} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Cancel/ }));

    expect(back).toHaveBeenCalled();
  });

  it("stays put when the guard says to keep editing", async () => {
    // The whole point of the control: an exit that asks, and that takes "no"
    // for an answer rather than leaving anyway.
    render(
      <FormPageHeader title="Edit plan" confirmDiscard={async () => false} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Cancel/ }));

    expect(back).not.toHaveBeenCalled();
  });

  it("takes its own word for the exit", () => {
    render(
      <FormPageHeader
        title="Edit plan"
        cancelLabel="Done"
        confirmDiscard={async () => true}
      />,
    );

    expect(screen.getByRole("button", { name: /Done/ })).toBeInTheDocument();
  });
});
