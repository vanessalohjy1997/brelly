import { render, screen } from "@testing-library/react";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders", () => {
    render(<HomePage />);
    expect(screen.getByRole("main")).toHaveTextContent("Brelly");
  });
});
