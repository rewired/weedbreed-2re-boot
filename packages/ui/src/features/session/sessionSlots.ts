import { isSessionEnvelope, type SessionEnvelope, type SessionSlot } from "./sessionEnvelope.types";

export const SESSION_SLOTS_STORAGE_KEY = "weed-breed.session-slots.v1";

export interface SessionSlotStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readSessionSlots(storage: SessionSlotStorage): readonly SessionSlot[] {
  try {
    const raw = storage.getItem(SESSION_SLOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((slot): slot is SessionSlot => {
      if (!slot || typeof slot !== "object") return false;
      const candidate = slot as Partial<SessionSlot>;
      return typeof candidate.name === "string"
        && candidate.name.trim().length > 0
        && isSessionEnvelope(candidate.session);
    });
  } catch {
    return [];
  }
}

export function writeSessionSlot(
  storage: SessionSlotStorage,
  name: string,
  session: SessionEnvelope
): readonly SessionSlot[] {
  const normalizedName = name.trim();
  if (!normalizedName) throw new TypeError("Der Speicherstand braucht einen Namen.");
  const remaining = readSessionSlots(storage).filter((slot) => slot.name !== normalizedName);
  const next = [...remaining, { name: normalizedName, session }];
  storage.setItem(SESSION_SLOTS_STORAGE_KEY, JSON.stringify(next));
  return next;
}
