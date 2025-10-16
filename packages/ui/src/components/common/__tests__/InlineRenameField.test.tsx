import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InlineRenameField } from "@ui/components/common/InlineRenameField";

describe("InlineRenameField", () => {
  it("renders rename button and toggles to input when editing", () => {
    const onSubmit = vi.fn();
    render(
      <InlineRenameField name="Green Harbor" label="Structure" onSubmit={onSubmit} />
    );

    expect(screen.getByRole("heading", { name: /green harbor/i })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /rename/i });
    fireEvent.click(button);

    const input = screen.getByRole("textbox", { name: /rename structure/i });
    expect(input).toHaveValue("Green Harbor");
  });

  it("validates empty and invalid names", () => {
    const onSubmit = vi.fn();
    render(
      <InlineRenameField name="Green Harbor" label="Structure" onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    const input = screen.getByRole("textbox", { name: /rename structure/i });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "Green Harbor!!!" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/unsupported characters/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed name", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineRenameField name="Green Harbor" label="Structure" onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    const input = screen.getByRole("textbox", { name: /rename structure/i });
    fireEvent.change(input, { target: { value: "  Harbor West  " } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await screen.findByRole("button", { name: /rename/i });
    expect(onSubmit).toHaveBeenCalledWith("Harbor West");
  });

  it("displays submission errors", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Transport offline"));
    render(
      <InlineRenameField name="Green Harbor" label="Structure" onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /rename structure/i }), {
      target: { value: "Harbor East" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/transport offline/i)).toBeInTheDocument();
  });
});
