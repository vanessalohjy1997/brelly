import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeSlot } from "@/test/fixtures";
import { renderWithQuery } from "@/test/renderWithQuery";

import { ItineraryCard } from "./ItineraryCard";

const weather = {
  forecast: "Thundery Showers",
  source: "2hr" as const,
  updatedAt: new Date().toISOString(),
  temperature: { low: 26, high: 31 },
};

const useWeatherForSlot = jest.fn<
  { data: unknown; isLoading: boolean; refetch: () => void },
  [unknown]
>(() => ({ data: weather, isLoading: false, refetch: jest.fn() }));
jest.mock("@/hooks/useWeatherForSlot", () => ({
  useWeatherForSlot: (params: unknown) => useWeatherForSlot(params as never),
}));
jest.mock("@/hooks/useUvIndex", () => ({
  useUvIndex: () => ({ data: { value: 3, updatedAt: null } }),
}));
jest.mock("next/link", () => {
  const Link = ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = "Link";
  return { __esModule: true, default: Link };
});

beforeEach(() => {
  jest.clearAllMocks();
  useWeatherForSlot.mockReturnValue({
    data: weather,
    isLoading: false,
    refetch: jest.fn(),
  });
});

describe("ItineraryCard", () => {
  it("links the stop's own title to its page, rather than making the card one target", () => {
    // The row actions are real buttons and a `<button>` inside an `<a>` is
    // invalid, so the title carries the link — which also gives it a name
    // instead of leaving an enormous anonymous target.
    renderWithQuery(<ItineraryCard slot={makeSlot()} onDelete={jest.fn()} />);

    expect(screen.getByRole("link", { name: "Lunch" })).toHaveAttribute(
      "href",
      "/plan/slot-1",
    );
  });

  it("stretches the title link over the whole card, without swallowing the buttons", () => {
    // Location, time and empty space all open the stop; the row actions,
    // being `relative` and later in the DOM, paint above the stretched area
    // and keep their own clicks.
    renderWithQuery(
      <ItineraryCard slot={makeSlot()} onDelete={jest.fn()} onToggleMute={jest.fn()} />,
    );

    expect(screen.getByRole("link", { name: "Lunch" })).toHaveClass(
      "after:absolute",
      "after:inset-0",
    );
    expect(screen.getByRole("button", { name: /^Delete/ }).parentElement).toHaveClass(
      "relative",
    );
  });

  it("offers an Edit link beside the actions, named for the stop", () => {
    // The title already opens the stop, but a pencil is the affordance that
    // says editing is possible without having to try it.
    renderWithQuery(<ItineraryCard slot={makeSlot()} onDelete={jest.fn()} />);

    expect(screen.getByRole("link", { name: "Edit Lunch" })).toHaveAttribute(
      "href",
      "/plan/slot-1",
    );
  });

  it("keeps the actions in the header row, edit first and delete last", () => {
    // They share the row with the time rather than take one of their own —
    // that row was the tallest thing on a card that gets scrolled by the
    // fortnight. Delete is last so the destructive one is not the first
    // thing reached.
    renderWithQuery(
      <ItineraryCard slot={makeSlot()} onDelete={jest.fn()} onToggleMute={jest.fn()} />,
    );

    const actions = screen.getByRole("button", { name: /^Delete/ }).parentElement!;
    // The time range, whichever zone the suite runs in — CI is UTC, a
    // developer's machine is usually not.
    expect(actions.parentElement).toContainElement(
      screen.getByText(/^\d{2}:\d{2} [ap]m – \d{2}:\d{2} [ap]m$/),
    );
    expect(
      Array.from(actions.children).map((child) => child.getAttribute("aria-label")),
    ).toEqual(["Edit Lunch", "Mute — turn rain alerts off for Lunch", "Delete Lunch"]);
  });

  it("puts both row actions on screen, always", async () => {
    // The phone hides them behind a left swipe. A swipe has no keyboard and no
    // pointer equivalent, and hover-reveal is unreachable by both.
    const onDelete = jest.fn();
    const onToggleMute = jest.fn();
    renderWithQuery(
      <ItineraryCard
        slot={makeSlot()}
        onDelete={onDelete}
        onToggleMute={onToggleMute}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Mute/ }));
    expect(onToggleMute).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^Delete/ }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("names the mute action with the word on the control", () => {
    // A name that does not contain the visible label is a Voice Control dead
    // end — "click Mute" matches nothing.
    renderWithQuery(
      <ItineraryCard
        slot={makeSlot({ notificationsMuted: true })}
        onDelete={jest.fn()}
        onToggleMute={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Unmute — turn rain alerts on/ }),
    ).toBeInTheDocument();
  });

  it("offers no mute on an archived stop, which has no alert left to mute", () => {
    renderWithQuery(
      <ItineraryCard slot={makeSlot()} past onDelete={jest.fn()} onToggleMute={jest.fn()} />,
    );

    expect(screen.queryByRole("button", { name: /Mute/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Delete/ })).toBeInTheDocument();
  });

  it("drops the whole weather column on an archived stop", async () => {
    // There is no forecast for a time that has passed, and a column of "No
    // forecast" would say nothing eight times over.
    renderWithQuery(<ItineraryCard slot={makeSlot()} past onDelete={jest.fn()} />);

    await waitFor(() =>
      expect(useWeatherForSlot).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      ),
    );
    expect(screen.queryByText("Thundery Showers")).not.toBeInTheDocument();
  });

  it("marks indoor, muted and repeating stops, and nothing else", () => {
    // Outdoor is the default and most of the list, so a glyph on every row
    // would carry no information and cost the label the width.
    renderWithQuery(
      <ItineraryCard
        slot={makeSlot({
          kind: "indoor",
          notificationsMuted: true,
          routineId: "routine-1",
        })}
        onDelete={jest.fn()}
        onToggleMute={jest.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Indoor stop" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Rain alerts off for this stop" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Repeating stop" })).toBeInTheDocument();
  });

  it("marks none of them on an ordinary outdoor stop", () => {
    renderWithQuery(<ItineraryCard slot={makeSlot()} onDelete={jest.fn()} />);

    expect(screen.queryByRole("img", { name: "Indoor stop" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Repeating stop" })).not.toBeInTheDocument();
  });

  it("draws the verdict watermark only when there is a verdict to draw", () => {
    const { rerender } = renderWithQuery(
      <ItineraryCard slot={makeSlot()} onDelete={jest.fn()} />,
    );
    expect(screen.getByTestId("umbrella-verdict-rain")).toBeInTheDocument();

    useWeatherForSlot.mockReturnValue({
      data: { ...weather, source: "error" },
      isLoading: false,
      refetch: jest.fn(),
    });
    rerender(<ItineraryCard slot={makeSlot()} onDelete={jest.fn()} />);

    // A placeholder forecast is not a verdict, so it earns neither the
    // watermark nor the accent bar.
    expect(screen.queryByTestId(/umbrella-verdict/)).not.toBeInTheDocument();
  });
});
