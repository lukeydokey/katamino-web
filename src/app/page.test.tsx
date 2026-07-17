import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home 페이지", () => {
  it("Katamino 웹 재구현 제목을 렌더링한다", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Katamino 웹 재구현",
      }),
    ).toBeInTheDocument();
  });
});
