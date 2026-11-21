import { afterEach, describe, expect, it, vi } from "vitest";
import { createCollectorVisionScannerApplet } from "./collectorvision-scanner-applet.mjs";

class FakeElement {
  context = {
    drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
  };
  getContext() { return this.context; }
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

  it("masks zones in captured frames and rejects overlapping detections before confirmation", async () => {
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("document", { createElement: () => new FakeElement() });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    vi.stubGlobal("Worker", class {
      addEventListener() {}
      postMessage() {}
      terminate() {}
    });
    const onResult = vi.fn();
    const onCardDetected = vi.fn();
    const zone = [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]];
    const applet = await createCollectorVisionScannerApplet({
      target: new FakeElement(), autoStart: false, ignoreZones: [zone],
      consecutiveMatches: 1, cooldownMs: 0, onResult, onCardDetected,
    });
    applet.stream = {};
    applet.elements.video.videoWidth = 1000;
    applet.elements.video.videoHeight = 500;
    expect(applet.drawCaptureFrame()).toBe(true);
    expect(applet.captureCtx.moveTo).toHaveBeenCalledWith(100, 50);
    expect(applet.captureCtx.lineTo).toHaveBeenCalledWith(400, 200);
    expect(applet.captureCtx.fill).toHaveBeenCalledOnce();

    const result = {
      cardPresent: true, cornersValid: true, score: 0.9, cardId: "card",
      corners: [[0.3, 0.3], [0.6, 0.3], [0.6, 0.6], [0.3, 0.6]],
    };
    applet.handleResult(result);
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ cardPresent: false, cardId: null }), applet);
    expect(onCardDetected).not.toHaveBeenCalled();
    applet.handleResult({ ...result, corners: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    expect(onCardDetected).not.toHaveBeenCalled();
    applet.handleResult({ ...result, corners: [[0.6, 0.6], [0.9, 0.6], [0.9, 0.9], [0.6, 0.9]] });
    expect(onCardDetected).toHaveBeenCalledOnce();

    applet.updateConfig({ ignoreZones: [] });
    applet.handleResult(result);
    expect(onCardDetected).toHaveBeenCalledTimes(2);
    applet.dispose();
  });
});
