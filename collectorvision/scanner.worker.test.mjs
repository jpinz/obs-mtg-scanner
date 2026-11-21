import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadLiveCatalog } = vi.hoisted(() => ({ loadLiveCatalog: vi.fn() }));

vi.mock("./vendor/onnxruntime-web/ort.webgpu.min.mjs?v=__BUILD_ID__", () => ({
  env: { wasm: {} },
  InferenceSession: { create: async () => ({ inputNames: ["input"] }) },
}));

vi.mock("./lib/collectorvision-catalog-v2.mjs", () => ({
  BrowserCatalogV2: { forGame: loadLiveCatalog },
}));

class FakeCanvas {
  getContext() {
    return { createImageData: () => ({}) };
  }
}

function cachedModelDb() {
  const database = {
    transaction: () => ({
      objectStore: () => ({
        get: () => {
          const request = { result: new ArrayBuffer(8) };
          queueMicrotask(() => request.onsuccess());
          return request;
        },
      }),
    }),
  };
  return {
    open: () => {
      const request = { result: database };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
}

const manifest = {
  version: "model-version",
  models: { detector: "detector.onnx", milo: "milo.onnx" },
  catalog: { dims: 2, rows: 10, embeddings: "legacy.bin", card_ids: "legacy.json" },
};

async function initializeWorker(catalogMode, allowedCardIds) {
  const worker = { postMessage: vi.fn() };
  vi.stubGlobal("self", worker);
  vi.stubGlobal("OffscreenCanvas", FakeCanvas);
  vi.stubGlobal("navigator", { userAgent: "", platform: "", hardwareConcurrency: 2 });
  vi.stubGlobal("indexedDB", cachedModelDb());
  await import("./scanner.worker.mjs");
  await worker.onmessage({
    data: { type: "init", manifest, catalogMode, allowedCardIds },
  });
  return worker.postMessage;
}

describe("scanner worker catalog loading", () => {
  beforeEach(() => {
    vi.resetModules();
    loadLiveCatalog.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses v2 and preserves filtering even when a legacy v1 mode is requested", async () => {
    loadLiveCatalog.mockResolvedValue({
      dimension: 2,
      rows: 2,
      version: 42,
      catalogKey: "live-mtg",
      records: [
        { id: "allowed", name: "Allowed", identifiers: { scryfall_oracle: "oracle" } },
        { id: "other", name: "Other", identifiers: {} },
      ],
      embeddings: new Uint16Array([1, 2, 3, 4]),
    });

    const postMessage = await initializeWorker("v1", ["allowed"]);

    expect(loadLiveCatalog).toHaveBeenCalledWith("mtg", expect.objectContaining({ includeMetadata: false }));
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "ready",
      catalogMode: "v2",
      catalogRows: 1,
      catalogTotalRows: 2,
      catalogVersion: 42,
      catalogKey: "live-mtg",
    }));
  });

  it("reports a live catalog failure instead of falling back to the bundled catalog", async () => {
    loadLiveCatalog.mockRejectedValue(new Error("Live feed unavailable"));

    const postMessage = await initializeWorker(undefined, undefined);

    expect(postMessage).toHaveBeenCalledWith({ type: "error", message: "Live feed unavailable" });
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "ready" }));
  });
});
