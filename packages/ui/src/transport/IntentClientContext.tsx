import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { IntentClient } from "@ui/transport/intentClient";

const IntentClientContext = createContext<IntentClient | null>(null);

export interface IntentClientProviderProps {
  readonly client: IntentClient | null;
  readonly children: ReactNode;
}

export function IntentClientProvider({ client, children }: IntentClientProviderProps): JSX.Element {
  const value = useMemo(() => client, [client]);
  return <IntentClientContext.Provider value={value}>{children}</IntentClientContext.Provider>;
}

export function useIntentClient(): IntentClient | null {
  return useContext(IntentClientContext);
}
