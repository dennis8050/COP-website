// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, it, expect } from "vitest";
import { State, Heading } from "../src/components/UI";
afterEach(cleanup);
it("shows loading feedback", () => {
  render(
    <State loading error="">
      <p>Data</p>
    </State>,
  );
  expect(screen.getByRole("status").textContent).toContain("Loading");
  expect(screen.queryByText("Data")).toBeNull();
});
it("shows error feedback", () => {
  render(
    <State loading={false} error="Connection failed">
      <p>Data</p>
    </State>,
  );
  expect(screen.getByRole("alert").textContent).toContain("Connection failed");
});
it("renders an accessible heading and action", () => {
  render(
    <Heading title="Members">
      <button>Add member</button>
    </Heading>,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Members");
  expect(screen.getByRole("button").textContent).toBe("Add member");
});
