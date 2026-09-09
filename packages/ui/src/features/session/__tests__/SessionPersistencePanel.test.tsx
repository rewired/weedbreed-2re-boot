import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IntentClient, IntentSubmissionResult } from "@ui/transport";
import { SessionPersistencePanel } from "../SessionPersistencePanel";
import { SESSION_SLOTS_STORAGE_KEY } from "../sessionSlots";
import type { SessionEnvelope } from "../sessionEnvelope.types";

const session: SessionEnvelope = {
  sessionSchemaVersion: 1,
  engineSave: { schemaVersion: 2, seed: "r801", simTime: { tick: 480, hoursElapsed: 480 }, world: { balanceCc: 42 } },
  worldHash: "b".repeat(64),
  playback: { status: "paused", speedMultiplier: 8 },
  journeyProgress: { milestones: [{ code: "f1-harvested", achievedAtSimTimeHours: 480, evidenceId: "ramp-one" }] }
};

function storageStub(initial: string | null = null) {
  let value = initial;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; }),
    value: () => value
  };
}

function clientReturning(result: IntentSubmissionResult): IntentClient {
  return { submit: vi.fn(async (_intent, handlers) => { handlers?.onResult(result); return result; }), disconnect: vi.fn(async () => undefined) };
}

function saveSuccess(): IntentSubmissionResult {
  return { ok: true, ack: { ok: true, status: "applied", result: { command: "session.save", session, replayed: false }, stateAfter: { simTimeHours: 480, worldHash: session.worldHash } } } as unknown as IntentSubmissionResult;
}

function loadSuccess(): IntentSubmissionResult {
  return { ok: true, ack: { ok: true, status: "applied", result: { command: "session.load", worldHash: session.worldHash, replayed: false }, stateAfter: { simTimeHours: 480, paused: true, speedMultiplier: 8, journeyMilestoneCount: 1 } } } as unknown as IntentSubmissionResult;
}

describe("SessionPersistencePanel", () => {
  it("persists the facade envelope only after a successful save acknowledgement", async () => {
    const storage = storageStub();
    const client = clientReturning(saveSuccess());
    render(<SessionPersistencePanel intentClient={client} sessionActive onLoaded={vi.fn()} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Spiel speichern" }));
    await screen.findByText("„First F1“ wurde gespeichert.");
    expect(storage.setItem).toHaveBeenCalledWith(SESSION_SLOTS_STORAGE_KEY, JSON.stringify([{ name: "First F1", session }]));
    expect(screen.getByLabelText("JSON Export")).toHaveValue(JSON.stringify(session));
  });

  it("refreshes exactly once after load acknowledgement and only then reveals the session", async () => {
    const storage = storageStub(JSON.stringify([{ name: "First F1", session }]));
    const refresh = vi.fn(async () => undefined);
    const loaded = vi.fn();
    render(<SessionPersistencePanel intentClient={clientReturning(loadSuccess())} sessionActive={false} onLoaded={loaded} onRefresh={refresh} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Laden" }));
    await waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(loaded.mock.invocationCallOrder[0]!);
  });

  it("keeps an invalid or facade-rejected import atomic and visible", async () => {
    const storage = storageStub();
    const rejected = clientReturning({ ok: false, ack: { ok: false, error: { code: "INVALID", message: "bad" } }, dictionary: { code: "INVALID", title: "Ungültig", description: "Hash stimmt nicht.", action: "Erneut exportieren" } });
    render(<SessionPersistencePanel intentClient={rejected} sessionActive={false} onLoaded={vi.fn()} storage={storage} />);
    fireEvent.change(screen.getByLabelText("JSON Import"), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "JSON importieren und laden" }));
    expect(screen.getByRole("alert")).toHaveTextContent("nicht lesbar");
    expect(storage.setItem).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("JSON Import"), { target: { value: JSON.stringify(session) } });
    fireEvent.click(screen.getByRole("button", { name: "JSON importieren und laden" }));
    await screen.findByText("Hash stimmt nicht.");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("does not claim success when browser persistence fails after a valid save ack", async () => {
    const storage = storageStub();
    storage.setItem.mockImplementation(() => { throw new Error("Quota erreicht"); });
    render(<SessionPersistencePanel intentClient={clientReturning(saveSuccess())} sessionActive onLoaded={vi.fn()} storage={storage} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Spiel speichern" })); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Quota erreicht");
    expect(screen.queryByText(/wurde gespeichert/)).not.toBeInTheDocument();
  });
});
