import { render, screen } from "@testing-library/react";

import Page from "@/app/page";

describe("Page", () => {
  it("renders the runtime overview", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { name: /deepagents runtime/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/single approved function/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/get_installed_skills/i).length).toBeGreaterThan(0);
  });
});
