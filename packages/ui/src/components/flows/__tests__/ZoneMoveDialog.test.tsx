import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ZoneMoveDialog } from "@ui/components/flows/ZoneMoveDialog";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import type { IntentClient } from "@ui/transport";
import type { RoomReadModel } from "@ui/state/readModels.types";

function createIntentClientStub(): { client: IntentClient; submit: ReturnType<typeof vi.fn> } {
  const submit = vi.fn(async () => ({ ok: true }));
  const client: IntentClient = {
    submit,
    async disconnect() {
      return Promise.resolve();
    }
  } satisfies IntentClient;
  return { client, submit };
}

describe("ZoneMoveDialog", () => {
  it("disables rooms that cannot host zones", () => {
    const structure = deterministicReadModelSnapshot.structures[0];
    const { client } = createIntentClientStub();

    render(
      <ZoneMoveDialog
        isOpen
        structureId={structure.id}
        zoneId="zone-veg-a-1"
        zoneName="Veg A-1"
        zoneArea={180}
        currentRoomId="room-veg-a"
        rooms={structure.rooms}
        intentClient={client}
        onClose={() => undefined}
      />
    );

    const storageroomOption = screen.getByRole("radio", { name: /post-processing/i });
    expect(storageroomOption).toBeDisabled();
    expect(screen.getByText(/purpose does not support zones/i)).toBeInTheDocument();
  });

  it("submits move intent for eligible target", async () => {
    const structure = deterministicReadModelSnapshot.structures[0];
    const baseRoom = JSON.parse(JSON.stringify(structure.rooms[0])) as RoomReadModel;
    const targetRoom: RoomReadModel = {
      ...baseRoom,
      id: "room-target",
      name: "Expansion Bay",
      capacity: {
        ...baseRoom.capacity,
        areaFree_m2: 500
      },
      zones: []
    };
    const rooms: RoomReadModel[] = [
      { ...baseRoom, capacity: { ...baseRoom.capacity, areaFree_m2: 120 } },
      targetRoom
    ];
    const stub = createIntentClientStub();
    const onClose = vi.fn();

    render(
      <ZoneMoveDialog
        isOpen
        structureId={structure.id}
        zoneId="zone-veg-a-1"
        zoneName="Veg A-1"
        zoneArea={100}
        currentRoomId="room-veg-a"
        rooms={rooms}
        intentClient={stub.client}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /expansion bay/i }));
    fireEvent.click(screen.getByRole("button", { name: /move zone/i }));

    await waitFor(() => {
      expect(stub.submit).toHaveBeenCalledWith(
        {
          type: "intent.zone.move.v1",
          structureId: structure.id,
          zoneId: "zone-veg-a-1",
          targetRoomId: "room-target"
        },
        expect.any(Object)
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
