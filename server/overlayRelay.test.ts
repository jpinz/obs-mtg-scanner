import { describe, expect, it, vi } from "vitest";
import { createWriteKey, sessionIdFor } from "../src/overlayState";
import type { CardInfo } from "../src/scryfall";
import { handleOverlayRequest, MemoryOverlayStore, STATE_TTL_SECONDS, UpstashOverlayStore } from "./overlayRelay";

const card: CardInfo = {
  id: "abc",
  name: "Lightning Bolt",
  setName: "Alpha",
  setCode: "lea",
  collectorNumber: "161",
  rarity: "common",
  imageUrl: null,
  prices: { usd: "1.00" },
  scryfallUri: "https://scryfall.com/card/lea/161",
};

function publish(store: MemoryOverlayStore, writeKey: string, body: unknown) {
  return handleOverlayRequest(
    new Request("https://example.test/api/overlay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${writeKey}` },
      body: JSON.stringify(body),
    }),
    store,
  );
}

async function read(store: MemoryOverlayStore, sessionId: string) {
  const response = await handleOverlayRequest(new Request(`https://example.test/api/overlay?session=${sessionId}`), store);
  return response.json();
}

describe("handleOverlayRequest", () => {
  it("publishes to the session derived from the write key and isolates sessions", async () => {
    const store = new MemoryOverlayStore();
    const mine = createWriteKey();
    const other = createWriteKey();

    expect((await publish(store, mine, { card })).status).toBe(204);

    expect(await read(store, await sessionIdFor(mine))).toEqual({ card, confidence: null });
    expect(await read(store, await sessionIdFor(other))).toEqual({ card: null });
  });

  it("rejects publishing without a valid write key", async () => {
    const store = new MemoryOverlayStore();
    const sessionId = await sessionIdFor(createWriteKey());

    // The public session ID from an OBS URL is not a write key.
    expect((await publish(store, sessionId, { card })).status).toBe(401);
    expect((await publish(store, "", { card })).status).toBe(401);
  });

  it("rejects invalid state and invalid sessions", async () => {
    const store = new MemoryOverlayStore();

    expect((await publish(store, createWriteKey(), { card: { name: "x" } })).status).toBe(400);
    const response = await handleOverlayRequest(new Request("https://example.test/api/overlay?session=nope"), store);
    expect(response.status).toBe(400);
  });

  it("reports storage failures as unavailable", async () => {
    const store = new MemoryOverlayStore();
    vi.spyOn(store, "set").mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await publish(store, createWriteKey(), { card })).status).toBe(503);
  });
});

describe("MemoryOverlayStore", () => {
  it("expires state after the TTL", async () => {
    let now = 0;
    const store = new MemoryOverlayStore(() => now);
    await store.set("s", { card, confidence: null });

    now = STATE_TTL_SECONDS * 1000 - 1;
    expect(await store.get("s")).toEqual({ card, confidence: null });
    now = STATE_TTL_SECONDS * 1000;
    expect(await store.get("s")).toBeNull();
  });
});

describe("UpstashOverlayStore", () => {
  it("stores state with a TTL and validates what it reads back", async () => {
    const commands: unknown[] = [];
    let stored: string | null = null;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const args = JSON.parse(String(init?.body)) as string[];
      commands.push(args);
      if (args[0] === "SET") stored = args[2];
      return Response.json({ result: args[0] === "GET" ? stored : "OK" });
    });
    const store = new UpstashOverlayStore("https://redis.test", "token", fetchImpl);

    await store.set("s", { card, confidence: null });
    expect(await store.get("s")).toEqual({ card, confidence: null });
    expect(commands[0]).toEqual(["SET", "overlay:s", JSON.stringify({ card, confidence: null }), "EX", String(STATE_TTL_SECONDS)]);
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer token" });

    stored = JSON.stringify({ card: { name: "tampered" } });
    expect(await store.get("s")).toBeNull();
  });
});
