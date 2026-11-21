import { createWriteKey, isWriteKey, sessionIdFor } from "../overlayState";

const WRITE_KEY_STORAGE_KEY = "mtg-scanner:overlay-key";

/** Identifies this browser's overlay: the private key publishes, the derived session ID reads. */
export interface OverlaySession {
  writeKey: string;
  sessionId: string;
}

/**
 * Reuses the write key saved in this browser so the OBS URL stays stable across visits,
 * creating one on first use.
 */
export async function loadOverlaySession(storage: Pick<Storage, "getItem" | "setItem">): Promise<OverlaySession> {
  let writeKey: string | null = null;
  try {
    writeKey = storage.getItem(WRITE_KEY_STORAGE_KEY);
  } catch {
    // Storage can be blocked; fall back to a key for this page load only.
  }
  if (!isWriteKey(writeKey)) {
    writeKey = createWriteKey();
    try {
      storage.setItem(WRITE_KEY_STORAGE_KEY, writeKey);
    } catch {
      // Same as above: the overlay still works, but its URL changes on the next visit.
    }
  }
  return { writeKey, sessionId: await sessionIdFor(writeKey) };
}
