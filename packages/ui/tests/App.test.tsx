import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@ui/App";

const transportMocks = vi.hoisted(() => ({
  submit: vi.fn()
}));

vi.mock("@ui/transport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ui/transport")>();
  return {
    ...actual,
    createTelemetryBinder: () => null,
    createReadModelClient: () => null,
    createIntentClient: () => ({
      submit: transportMocks.submit,
      disconnect: vi.fn(async () => undefined)
    })
  };
});

describe("App", () => {
  beforeEach(() => {
    transportMocks.submit.mockReset();
  });

  it("opens on the new-game screen before a session is acknowledged", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /new game/i })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: /global navigation/i })).not.toBeInTheDocument();
  });

  it("enters the workspace only after game.new.v1 is acknowledged", async () => {
    transportMocks.submit.mockImplementation(async (_intent, handlers) => {
      const result = { ok: true as const, ack: { ok: true as const } };
      handlers.onResult(result);
      return result;
    });
    render(<App />);

    fireEvent.change(screen.getByLabelText("Company Name"), {
      target: { value: "Green Labs" }
    });
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));

    await waitFor(() => expect(transportMocks.submit).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Erzeuge und teste deine erste F1")).toBeVisible();
    expect(screen.getByText("0/9")).toBeVisible();
  });
});
