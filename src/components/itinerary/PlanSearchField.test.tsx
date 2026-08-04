import { fireEvent, render } from "@testing-library/react-native";

import { PlanSearchField } from "@/components/itinerary/PlanSearchField";

describe("PlanSearchField", () => {
  it("reports every keystroke, so the list filters as you type", async () => {
    const onChange = jest.fn();
    const view = await render(
      <PlanSearchField value="" onChange={onChange} placeholder="Search plans" />,
    );

    await fireEvent.changeText(view.getByLabelText("Search plans"), "bota");

    expect(onChange).toHaveBeenCalledWith("bota");
  });

  it("has no clear button until there is something to clear", async () => {
    const view = await render(
      <PlanSearchField
        value=""
        onChange={jest.fn()}
        placeholder="Search plans"
      />,
    );

    expect(view.queryByLabelText("Clear search")).toBeNull();
  });

  it("clears back to a blank query in one tap", async () => {
    const onChange = jest.fn();
    const view = await render(
      <PlanSearchField
        value="botanic"
        onChange={onChange}
        placeholder="Search plans"
      />,
    );

    await fireEvent.press(view.getByLabelText("Clear search"));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("labels itself with the list it narrows", async () => {
    const view = await render(
      <PlanSearchField
        value=""
        onChange={jest.fn()}
        placeholder="Search past plans"
      />,
    );

    expect(view.getByLabelText("Search past plans")).toBeTruthy();
  });
});
