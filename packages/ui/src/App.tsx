import type { ReactElement } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import {
  IntentClientProvider,
  createIntentClient,
  createTelemetryBinder,
  createReadModelClient
} from "@ui/transport";
import { workspaceRoutes } from "@ui/routes/workspaceRoutes";
import { configureReadModelClient } from "@ui/state/readModels";
import { SessionGate } from "@ui/features/session/SessionGate";

function normaliseEnvUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const httpBaseFromEnv = normaliseEnvUrl(import.meta.env.VITE_FACADE_HTTP_BASE_URL as string | undefined);
const transportBaseFromEnv = normaliseEnvUrl(
  import.meta.env.VITE_FACADE_TRANSPORT_BASE_URL as string | undefined
);
const legacyCoHostedBase = normaliseEnvUrl(import.meta.env.VITE_TRANSPORT_BASE_URL as string | undefined);

let coHostedFallback: string | null = null;
if (!httpBaseFromEnv || !transportBaseFromEnv) {
  if (legacyCoHostedBase) {
    coHostedFallback = legacyCoHostedBase;
  } else if (!httpBaseFromEnv && !transportBaseFromEnv && typeof window !== "undefined") {
    coHostedFallback = window.location.origin ?? null;
  }
}

const httpBaseUrl = httpBaseFromEnv ?? coHostedFallback;
const transportBaseUrl = transportBaseFromEnv ?? coHostedFallback;

if (!httpBaseFromEnv) {
  if (coHostedFallback) {
    console.warn(
      `Read-model HTTP base URL missing: assuming co-hosted façade at ${coHostedFallback}. ` +
        "Configure VITE_FACADE_HTTP_BASE_URL to override."
    );
  } else {
    console.warn(
      "Read-model client initialisation skipped: VITE_FACADE_HTTP_BASE_URL is not configured."
    );
  }
}

if (!transportBaseFromEnv) {
  if (coHostedFallback) {
    console.warn(
      `Transport base URL missing: assuming co-hosted façade at ${coHostedFallback}. ` +
        "Configure VITE_FACADE_TRANSPORT_BASE_URL to override."
    );
  } else {
    console.warn(
      "Telemetry binder initialisation skipped: VITE_FACADE_TRANSPORT_BASE_URL is not configured."
    );
  }
}

const telemetryBinder = transportBaseUrl ? createTelemetryBinder({ baseUrl: transportBaseUrl }) : null;

const readModelClient = httpBaseUrl ? createReadModelClient({ httpBaseUrl }) : null;

const intentClient = transportBaseUrl ? createIntentClient({ baseUrl: transportBaseUrl }) : null;

if (telemetryBinder) {
  telemetryBinder.connect();
}

if (readModelClient) {
  configureReadModelClient(readModelClient);
}

const router = createBrowserRouter(workspaceRoutes);

function App(): ReactElement {
  return (
    <IntentClientProvider client={intentClient}>
      <SessionGate>
        <RouterProvider router={router} />
      </SessionGate>
    </IntentClientProvider>
  );
}

export default App;
