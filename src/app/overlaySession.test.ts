import { describe, expect, it } from "vitest";
import { isSessionId, sessionIdFor } from "../overlayState";
import { loadOverlaySession } from "./overlaySession";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe("loadOverlaySession", () => {
  it("keeps the same overlay URL across visits", async () => {
    const storage = memoryStorage();
    const first = await loadOverlaySession(storage);
    const second = await loadOverlaySession(storage);

    expect(second).toEqual(first);
    expect(isSessionId(first.sessionId)).toBe(true);
    expect(first.sessionId).toBe(await sessionIdFor(first.writeKey));
    expect(first.sessionId).not.toBe(first.writeKey);
  });

  it("replaces a corrupted key", async () => {
    const storage = memoryStorage({ "mtg-scanner:overlay-key": "garbage" });
    const session = await loadOverlaySession(storage);

    expect(session.writeKey).not.toBe("garbage");
    expect(storage.items.get("mtg-scanner:overlay-key")).toBe(session.writeKey);
  });
});
