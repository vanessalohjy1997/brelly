import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanSearchField, SearchThreshold } from "./PlanSearchField";

describe("PlanSearchField", () => {
  it("earns its space only past a list worth searching", () => {
    // On stops rather than days, because a day holding six stops is exactly
    // the case worth a search field.
    expect(SearchThreshold).toBe(6);
  });

  it("names which list is being narrowed", () => {
    render(
      <PlanSearchField value="" onChange={jest.fn()} placeholder="Search past plans" />,
    );
    expect(
      screen.getByRole("searchbox", { name: "Search past plans" }),
    ).toBeInTheDocument();
  });

  it("reports every keystroke, undebounced", async () => {
    // `filterPlans` is a substring scan over an array already in memory, so the
    // work per keystroke is far below a frame; a debounce would only add lag
    // between the character and the result.
    const onChange = jest.fn();
    render(
      <PlanSearchField value="" onChange={onChange} placeholder="Search plans" />,
    );

    await userEvent.type(screen.getByRole("searchbox"), "lu");

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("offers a clear control only once there is something to clear", async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <PlanSearchField value="" onChange={onChange} placeholder="Search plans" />,
    );
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument();

    rerender(
      <PlanSearchField value="lunch" onChange={onChange} placeholder="Search plans" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onChange).toHaveBeenCalledWith("");
  });
});
