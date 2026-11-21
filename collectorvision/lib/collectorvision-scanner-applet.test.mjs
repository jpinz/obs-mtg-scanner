import { afterEach, describe, expect, it, vi } from "vitest";
import { createCollectorVisionScannerApplet } from "./collectorvision-scanner-applet.mjs";

class FakeElement {
  getContext() { return {}; }
  querySelector() { return new FakeElement(); }
  replaceChildren() {}
}

describe("CollectorVision scanner applet", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("always requests the live v2 catalog, even with a legacy v1 configuration", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("document", { createElement: () => new FakeElement() });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    vi.stubGlobal("Worker", class {
      addEventListener() {}
      postMessage(message) { postMessage(message); }
      terminate() {}
    });

    const applet = await createCollectorVisionScannerApplet({
      target: new FakeElement(),
      autoStart: false,
      catalogMode: "v1",
      allowedCardIds: ["print-1"],
    });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "init",
      catalogMode: "v2",
      allowedCardIds: ["print-1"],
    }));
    applet.dispose();
  });
});
