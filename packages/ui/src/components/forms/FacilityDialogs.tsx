import { useMemo, useState, type FormEvent, type ReactElement } from "react";
import type { IntentClient, IntentSubmissionHandlers } from "@ui/transport";
import type { TransportIntentEnvelope } from "@wb/transport-sio";
import type {
  CompatibilityMaps,
  ContainerPriceEntry,
  IrrigationLinePriceEntry,
  PriceBookCatalog,
  RoomReadModel,
  SeedlingPriceEntry,
  StructureReadModel,
  SubstratePriceEntry,
  ZoneReadModel
} from "@ui/state/readModels.types";
import {
  deriveZoneWizardResult,
  findSeedlingPriceForStrain,
  validateRoomCreate,
  validateSowing,
  type RoomAreaUpdateResult,
  type RoomCreateIntentPayload,
  type RoomDuplicateResult,
  type RoomSetAreaIntentPayload,
  type SowingResult,
  type ZoneAreaUpdateResult,
  type ZoneCreateIntentPayload,
  type ZoneDuplicateResult
} from "@ui/lib/facilityFlows";

type SelectOption<T> = Readonly<{ id: string; label: string; value: T }>;

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

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
        // acknowledgement handled by resolved result
      }
    };
    const result = await intentClient.submit(payload, handlers);

    if (result.ok) {
      setSubmission({ isSubmitting: false, error: null });
      if (onSuccess) {
        onSuccess();
      }
      return;
    }

    setSubmission({ isSubmitting: false, error: result.dictionary.description });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit intent.";
    setSubmission({ isSubmitting: false, error: message });
  }
}

interface RoomCreateDialogProps {
  readonly structure: StructureReadModel;
  readonly intentClient: IntentClient;
  readonly onSubmitted?: () => void;
}

export function RoomCreateDialog({ structure, intentClient, onSubmitted }: RoomCreateDialogProps): ReactElement {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("growroom");
  const [areaInput, setAreaInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [submission, setSubmission] = useSubmissionState();

  const areaValue = parseNumber(areaInput) ?? Number.NaN;
  const heightValue = parseNumber(heightInput);

  const validation = useMemo(() =>
    validateRoomCreate({
      structure,
      name,
      purpose,
      area_m2: areaValue,
      height_m: heightValue
    }),
  [structure, name, purpose, areaValue, heightValue]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.payload) {
      return;
    }

    void submitIntent(validation.payload, intentClient, setSubmission, onSubmitted);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="flex flex-col">
          <span className="font-medium">Room name</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Purpose</span>
          <input
            value={purpose}
            onChange={(event) => {
              setPurpose(event.target.value);
            }}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Area (m²)</span>
          <input
            value={areaInput}
            onChange={(event) => {
              setAreaInput(event.target.value);
            }}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Height (m, optional)</span>
          <input
            value={heightInput}
            onChange={(event) => {
              setHeightInput(event.target.value);
            }}
            className="border rounded px-2 py-1"
          />
        </label>
      </div>

      {validation.errors.length > 0 && (
        <ul className="text-sm text-red-600 list-disc list-inside">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {submission.error && <p className="text-sm text-red-600">{submission.error}</p>}

      <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white" disabled={!validation.isValid || submission.isSubmitting}>
        Create room
      </button>
    </form>
  );
}

interface ZoneCreateWizardProps {
  readonly room: RoomReadModel;
  readonly compatibility: CompatibilityMaps;
  readonly intentClient: IntentClient;
  readonly cultivationOptions: readonly SelectOption<{ areaPerPlant_m2: number }>[];
  readonly irrigationOptions: readonly SelectOption<null>[];
  readonly seedlingOptions: readonly SelectOption<SeedlingPriceEntry | null>[];
  readonly containerOptions: readonly SelectOption<ContainerPriceEntry | null>[];
  readonly substrateOptions: readonly SelectOption<SubstratePriceEntry | null>[];
  readonly irrigationLineOptions: readonly SelectOption<IrrigationLinePriceEntry | null>[];
  readonly onSubmitted?: () => void;
}

export function ZoneCreateWizard({
  room,
  compatibility,
  intentClient,
  cultivationOptions,
  irrigationOptions,
  seedlingOptions,
  containerOptions,
  substrateOptions,
  irrigationLineOptions,
  onSubmitted
}: ZoneCreateWizardProps): ReactElement {
  const [areaInput, setAreaInput] = useState("");
  const [cultivationId, setCultivationId] = useState(cultivationOptions[0]?.id ?? "");
  const [irrigationId, setIrrigationId] = useState(irrigationOptions[0]?.id ?? "");
  const [seedlingId, setSeedlingId] = useState(seedlingOptions[0]?.id ?? "");
  const [containerId, setContainerId] = useState(containerOptions[0]?.id ?? "");
  const [substrateId, setSubstrateId] = useState(substrateOptions[0]?.id ?? "");
  const [lineId, setLineId] = useState(irrigationLineOptions[0]?.id ?? "");
  const [submission, setSubmission] = useSubmissionState();

  const areaValue = parseNumber(areaInput) ?? Number.NaN;
  const cultivation = cultivationOptions.find((option) => option.id === cultivationId) ?? null;
  const seedling = seedlingOptions.find((option) => option.id === seedlingId)?.value ?? null;
  const container = containerOptions.find((option) => option.id === containerId)?.value ?? null;
  const substrate = substrateOptions.find((option) => option.id === substrateId)?.value ?? null;
  const irrigationLine = irrigationLineOptions.find((option) => option.id === lineId)?.value ?? null;

  const validation = useMemo(() =>
    deriveZoneWizardResult({
      room,
      area_m2: areaValue,
      cultivationMethodId: cultivationId,
      areaPerPlant_m2: cultivation?.value.areaPerPlant_m2 ?? 0,
      irrigationMethodId: irrigationId,
      seedlingPrice: seedling ?? null,
      containerPrice: container ?? null,
      substratePrice: substrate ?? null,
      irrigationLinePrice: irrigationLine ?? null,
      compatibility
    }),
  [room, areaValue, cultivationId, cultivation?.value.areaPerPlant_m2, irrigationId, seedling, container, substrate, irrigationLine, compatibility]);

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
        label: "Capacity",
        detail: validation.capacity,
        fallback: "Room capacity available for zone creation."
      },
      {
        key: "cultivation",
        label: "Cultivation",
        detail: validation.cultivation,
        fallback: "Cultivation method supported."
      },
      {
        key: "irrigation",
        label: "Irrigation",
        detail: validation.irrigation,
        fallback: "Irrigation method supported."
      }
    ],
    [validation.capacity, validation.cultivation, validation.irrigation]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3">
        <label className="flex flex-col">
          <span className="font-medium">Zone area (m²)</span>
          <input
            value={areaInput}
            onChange={(event) => {
              setAreaInput(event.target.value);
            }}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Cultivation method</span>
          <select
            value={cultivationId}
            onChange={(event) => {
              setCultivationId(event.target.value);
            }}
            className="border rounded px-2 py-1"
          >
            {cultivationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Irrigation method</span>
          <select
            value={irrigationId}
            onChange={(event) => {
              setIrrigationId(event.target.value);
            }}
            className="border rounded px-2 py-1"
          >
            {irrigationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Seedling price</span>
          <select
            value={seedlingId}
            onChange={(event) => {
              setSeedlingId(event.target.value);
            }}
            className="border rounded px-2 py-1"
          >
            {seedlingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Container</span>
          <select
            value={containerId}
            onChange={(event) => {
              setContainerId(event.target.value);
            }}
            className="border rounded px-2 py-1"
          >
            {containerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Substrate</span>
          <select
            value={substrateId}
            onChange={(event) => {
              setSubstrateId(event.target.value);
            }}
            className="border rounded px-2 py-1"
          >
            {substrateOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="font-medium">Irrigation line</span>
          <select
            value={lineId}
            onChange={(event) => {
              setLineId(event.target.value);
            }}
            className="border rounded px-2 py-1"
          >
            {irrigationLineOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="space-y-1 text-sm text-text-muted" aria-live="polite">
        {statusEntries.map(({ key, label, detail, fallback }) => (
          <li key={key} data-status={detail.status}>
            <span className="font-semibold text-text-primary">{label}:</span> {detail.message ?? fallback}
          </li>
        ))}
        <li>
          <span className="font-semibold text-text-primary">Max plants:</span> {validation.maxPlants}
        </li>
        <li>
          <span className="font-semibold text-text-primary">Acquisition cost preview:</span> {validation.acquisitionCost.toFixed(2)}
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
        Create zone
      </button>
    </form>
  );
}

interface ZoneSowingDialogProps {
  readonly zone: ZoneReadModel;
  readonly compatibility: CompatibilityMaps;
  readonly priceBook: PriceBookCatalog;
  readonly intentClient: IntentClient;
  readonly strainOptions: readonly SelectOption<string>[];
  readonly onSubmitted?: () => void;
}

export function ZoneSowingDialog({
  zone,
  compatibility,
  priceBook,
  intentClient,
  strainOptions,
  onSubmitted
}: ZoneSowingDialogProps): ReactElement {
  const [strainId, setStrainId] = useState(strainOptions[0]?.value ?? "");
  const [countInput, setCountInput] = useState("");
  const [submission, setSubmission] = useSubmissionState();

  const countValue = parseNumber(countInput) ?? Number.NaN;
  const seedlingPrice = findSeedlingPriceForStrain(priceBook, strainId);

  const validation = useMemo(
    () =>
      validateSowing({
        zone,
        strainId,
        count: Number.isFinite(countValue) ? Math.trunc(countValue) : NaN,
        compatibility,
        seedlingPrice
      }),
    [zone, strainId, countValue, compatibility, seedlingPrice]
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
        key: "cultivation",
        label: "Cultivation",
        detail: validation.compatibility.cultivation,
        fallback: "Strain compatible with cultivation method."
      },
      {
        key: "irrigation",
        label: "Irrigation",
        detail: validation.compatibility.irrigation,
        fallback: "Strain compatible with irrigation method."
      }
    ],
    [validation.compatibility.cultivation, validation.compatibility.irrigation]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col">
        <span className="font-medium">Strain</span>
        <select
          value={strainId}
          onChange={(event) => {
            setStrainId(event.target.value);
          }}
          className="border rounded px-2 py-1"
        >
          {strainOptions.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col">
        <span className="font-medium">Plant count</span>
        <input
          value={countInput}
          onChange={(event) => {
            setCountInput(event.target.value);
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
          <span className="font-semibold text-text-primary">Cost preview:</span> {validation.totalCost.toFixed(2)}
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
        Sow plants
      </button>
    </form>
  );
}

export {
  RoomAreaUpdateDialog,
  RoomDuplicateDialog,
  ZoneAreaUpdateDialog,
  ZoneDuplicateDialog
} from "./FacilityUpdateDialogs";
export type {
  RoomCreateIntentPayload,
  ZoneCreateIntentPayload,
  SowingResult,
  ZoneDuplicateResult,
  RoomDuplicateResult,
  RoomAreaUpdateResult,
  ZoneAreaUpdateResult,
  RoomSetAreaIntentPayload
};
