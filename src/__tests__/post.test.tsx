import { render, screen } from "@testing-library/react";

// Minimal smoke test — expand as features are built
describe("placeholder", () => {
  it("renders without crashing", () => {
    const { container } = render(<div data-testid="root">Hello</div>);
    expect(screen.getByTestId("root")).toBeInTheDocument();
    expect(container).toBeTruthy();
  });
});
