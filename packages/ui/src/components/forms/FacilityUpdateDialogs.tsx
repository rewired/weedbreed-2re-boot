import { useMemo, useState, type FormEvent, type ReactElement } from "react";
import type { IntentClient, IntentSubmissionHandlers } from "@ui/transport";
import type { TransportIntentEnvelope } from "@wb/transport-sio";
import type {
  CompatibilityMaps,
  PriceBookCatalog,
  RoomReadModel,
  StructureReadModel,
  ZoneReadModel
} from "@ui/state/readModels.types";
import {
  previewRoomDuplicate,
  previewZoneDuplicate,
  validateRoomAreaUpdate,
  validateZoneAreaUpdate,
  type RoomAreaUpdateResult,
  type ZoneAreaUpdateResult
} from "@ui/lib/facilityFlows";

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface SubmissionState {
  readonly isSubmitting: boolean;
  readonly error: string | null;
}

function useSubmissionState(): [SubmissionState, (updater: SubmissionState) => void] {
  const [state, setState] = useState<SubmissionState>({ isSubmitting: false, error: null });
  return [state, setState];
}

async function submitIntent(
  payload: TransportIntentEnvelope,
  intentClient: IntentClient,
  setSubmission: (state: SubmissionState) => void,
  onSuccess?: () => void
): Promise<void> {
  setSubmission({ isSubmitting: true, error: null });
  try {
    const handlers: IntentSubmissionHandlers = {
      onResult() {
        // The resolved result below owns the local submission state.
      }
    };
    const result = await intentClient.submit(payload, handlers);
    if (result.ok) {
      setSubmission({ isSubmitting: false, error: null });
      onSuccess?.();
      return;
    }
    setSubmission({ isSubmitting: false, error: result.dictionary.description });
  } catch (error) {
    setSubmission({
      isSubmitting: false,
      error: error instanceof Error ? error.message : "Failed to submit intent."
    });
  }
}

interface RoomDuplicateDialogProps {
  readonly structure: StructureReadModel;
  readonly room: RoomReadModel;
  readonly priceBook: PriceBookCatalog;
  readonly intentClient: IntentClient;
  readonly onSubmitted?: () => void;
}

export function RoomDuplicateDialog({
  structure,
  room,
  priceBook,
  intentClient,
  onSubmitted
}: RoomDuplicateDialogProps): ReactElement {
  const [copiesInput, setCopiesInput] = useState("1");
  const [submission, setSubmission] = useSubmissionState();
  const copiesValue = parseNumber(copiesInput) ?? Number.NaN;

  const validation = useMemo(
    () =>
      previewRoomDuplicate({
        structure,
        room,
        copies: Number.isFinite(copiesValue) ? Math.trunc(copiesValue) : NaN,
        priceBook
      }),
    [structure, room, copiesValue, priceBook]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.payload) {
      return;
    }

    void submitIntent(validation.payload, intentClient, setSubmission, onSubmitted);
  };

  const capacityEntries = useMemo(
    () => [
      {
        key: "area",
        label: "Structure area",
        detail: validation.capacity.area,
        fallback: "Structure area available."
      },
      {
        key: "volume",
        label: "Structure volume",
        detail: validation.capacity.volume,
        fallback: "Structure volume available."
      }
    ],
    [validation.capacity.area, validation.capacity.volume]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col">
        <span className="font-medium">Number of copies</span>
        <input
          value={copiesInput}
          onChange={(event) => {
            setCopiesInput(event.target.value);
          }}
          className="border rounded px-2 py-1"
        />
      </label>

      <ul className="space-y-1 text-sm text-text-muted" aria-live="polite">
        {capacityEntries.map(({ key, label, detail, fallback }) => (
          <li key={key} data-status={detail.status}>
            <span className="font-semibold text-text-primary">{label}:</span> {detail.message ?? fallback}
          </li>
        ))}
        <li>
          <span className="font-semibold text-text-primary">Device capex preview:</span> {validation.deviceCapitalExpenditure.toFixed(2)}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Cloned plants:</span> {validation.clonedPlantCount}
        </li>
      </ul>

      {validation.errors.length > 0 && (
        <ul className="text-sm text-red-600 list-disc list-inside">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {submission.error && <p className="text-sm text-red-600">{submission.error}</p>}

      <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white" disabled={!validation.isValid || submission.isSubmitting}>
        Duplicate room
      </button>
    </form>
  );
}

interface ZoneDuplicateDialogProps {
  readonly structure: StructureReadModel;
  readonly room: RoomReadModel;
  readonly zone: ZoneReadModel;
  readonly priceBook: PriceBookCatalog;
  readonly compatibility: CompatibilityMaps;
  readonly intentClient: IntentClient;
  readonly onSubmitted?: () => void;
}

export function ZoneDuplicateDialog({
  structure,
  room,
  zone,
  priceBook,
  compatibility,
  intentClient,
  onSubmitted
}: ZoneDuplicateDialogProps): ReactElement {
  const [copiesInput, setCopiesInput] = useState("1");
  const [submission, setSubmission] = useSubmissionState();
  const copiesValue = parseNumber(copiesInput) ?? Number.NaN;

  const validation = useMemo(
    () =>
      previewZoneDuplicate({
        structure,
        room,
        zone,
        copies: Number.isFinite(copiesValue) ? Math.trunc(copiesValue) : NaN,
        priceBook,
        compatibility
      }),
    [structure, room, zone, copiesValue, priceBook, compatibility]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.payload) {
      return;
    }

    void submitIntent(validation.payload, intentClient, setSubmission, onSubmitted);
  };

  const statusEntries = useMemo(
    () => [
      {
        key: "capacity",
        label: "Room capacity",
        detail: validation.capacity,
        fallback: "Room capacity available."
      },
      {
        key: "cultivation",
        label: "Cultivation",
        detail: validation.cultivation,
        fallback: "Cultivation method available."
      },
      {
        key: "irrigation",
        label: "Irrigation",
        detail: validation.irrigation,
        fallback: "Irrigation method available."
      }
    ],
    [validation.capacity, validation.cultivation, validation.irrigation]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col">
        <span className="font-medium">Number of copies</span>
        <input
          value={copiesInput}
          onChange={(event) => {
            setCopiesInput(event.target.value);
          }}
          className="border rounded px-2 py-1"
        />
      </label>

      <ul className="space-y-1 text-sm text-text-muted" aria-live="polite">
        {statusEntries.map(({ key, label, detail, fallback }) => (
          <li key={key} data-status={detail.status}>
            <span className="font-semibold text-text-primary">{label}:</span> {detail.message ?? fallback}
          </li>
        ))}
        <li>
          <span className="font-semibold text-text-primary">Device capex preview:</span> {validation.deviceCapitalExpenditure.toFixed(2)}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Cloned plants:</span> {validation.clonedPlantCount}
        </li>
      </ul>

      {validation.errors.length > 0 && (
        <ul className="text-sm text-red-600 list-disc list-inside">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {submission.error && <p className="text-sm text-red-600">{submission.error}</p>}

      <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white" disabled={!validation.isValid || submission.isSubmitting}>
        Duplicate zone
      </button>
    </form>
  );
}

interface RoomAreaUpdateDialogProps {
  readonly structure: StructureReadModel;
  readonly room: RoomReadModel;
  readonly intentClient: IntentClient;
  readonly onSubmitted?: (result: RoomAreaUpdateResult) => void;
}

export function RoomAreaUpdateDialog({
  structure,
  room,
  intentClient,
  onSubmitted
}: RoomAreaUpdateDialogProps): ReactElement {
  const [areaInput, setAreaInput] = useState("");
  const [submission, setSubmission] = useSubmissionState();
  const areaValue = parseNumber(areaInput) ?? Number.NaN;

  const validation = useMemo(
    () => validateRoomAreaUpdate({ structure, room, nextArea_m2: areaValue }),
    [structure, room, areaValue]
  );

  const capacityEntries = useMemo(
    () => [
      {
        key: "area",
        label: "Structure area",
        detail: validation.capacity.area,
        fallback: "Structure area available."
      },
      {
        key: "volume",
        label: "Structure volume",
        detail: validation.capacity.volume,
        fallback: "Structure volume available."
      }
    ],
    [validation.capacity.area, validation.capacity.volume]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.payload) {
      return;
    }

    void submitIntent(validation.payload, intentClient, setSubmission, () => {
      onSubmitted?.(validation);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col">
        <span className="font-medium">New area (m²)</span>
        <input
          value={areaInput}
          onChange={(event) => {
            setAreaInput(event.target.value);
          }}
          className="border rounded px-2 py-1"
        />
      </label>

      <ul className="space-y-1 text-sm text-text-muted" aria-live="polite">
        {capacityEntries.map(({ key, label, detail, fallback }) => (
          <li key={key} data-status={detail.status}>
            <span className="font-semibold text-text-primary">{label}:</span> {detail.message ?? fallback}
          </li>
        ))}
        <li>
          <span className="font-semibold text-text-primary">Projected volume:</span> {validation.nextVolume_m3.toFixed(2)}
        </li>
      </ul>

      {validation.errors.length > 0 && (
        <ul className="text-sm text-red-600 list-disc list-inside">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {submission.error && <p className="text-sm text-red-600">{submission.error}</p>}

      <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white" disabled={!validation.isValid || submission.isSubmitting}>
        Update room area
      </button>
    </form>
  );
}

interface ZoneAreaUpdateDialogProps {
  readonly room: RoomReadModel;
  readonly zone: ZoneReadModel;
  readonly areaPerPlant_m2: number;
  readonly intentClient: IntentClient;
  readonly onSubmitted?: (result: ZoneAreaUpdateResult) => void;
}

export function ZoneAreaUpdateDialog({
  room,
  zone,
  areaPerPlant_m2,
  intentClient,
  onSubmitted
}: ZoneAreaUpdateDialogProps): ReactElement {
  const [areaInput, setAreaInput] = useState("");
  const [submission, setSubmission] = useSubmissionState();
  const areaValue = parseNumber(areaInput) ?? Number.NaN;

  const validation = useMemo(
    () => validateZoneAreaUpdate({ room, zone, nextArea_m2: areaValue, areaPerPlant_m2 }),
    [room, zone, areaValue, areaPerPlant_m2]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.payload) {
      return;
    }

    void submitIntent(validation.payload, intentClient, setSubmission, () => {
      onSubmitted?.(validation);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col">
        <span className="font-medium">New area (m²)</span>
        <input
          value={areaInput}
          onChange={(event) => {
            setAreaInput(event.target.value);
          }}
          className="border rounded px-2 py-1"
        />
      </label>

      <ul className="space-y-1 text-sm text-text-muted" aria-live="polite">
        <li data-status={validation.capacity.status}>
          <span className="font-semibold text-text-primary">Room capacity:</span> {validation.capacity.message ?? "Room capacity available."}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Max plants:</span> {validation.maxPlants}
        </li>
      </ul>

      {validation.errors.length > 0 && (
        <ul className="text-sm text-red-600 list-disc list-inside">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {submission.error && <p className="text-sm text-red-600">{submission.error}</p>}

      <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white" disabled={!validation.isValid || submission.isSubmitting}>
        Update zone area
      </button>
    </form>
  );
}
