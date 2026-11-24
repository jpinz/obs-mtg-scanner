import { describe, expect, it, vi } from "vitest";
import type { Applet, ScannerCallbacks, ScannerOptions } from "./scanner";
import { ScannerController, type AppletFactory, type ScannerEvents } from "./scannerController";

class FakeApplet extends EventTarget implements Applet {
  config = { camera: {} as MediaTrackConstraints };
  start = vi.fn(async () => {});
  stop = vi.fn();
  updateConfig = vi.fn();
  dispose = vi.fn();
}

const events: ScannerEvents = {
  onCameraState: vi.fn(),
  onModelStatus: vi.fn(),
  onError: vi.fn(),
  onResult: vi.fn(),
  onCardDetected: vi.fn(),
};

describe("ScannerController", () => {
  it("resolves Scryfall filters before loading and starts the scanner", async () => {
    const applet = new FakeApplet();
    const target = { replaceChildren: vi.fn() } as unknown as HTMLElement;
    const factory: AppletFactory = vi.fn(async (_target: HTMLElement, _options: ScannerOptions, _callbacks: ScannerCallbacks) => applet);
    const resolveCardIds = vi.fn(async () => ["print-1", "print-2"]);
    const controller = new ScannerController(
      target,
      {
        camera: {},
        catalog: { setCodes: ["woe"], query: "t:creature" },
        threshold: 0.6,
        ignoreZones: [],
      },
      events,
      factory,
      resolveCardIds,
    );

    controller.start();
    await controller.idle;

    expect(resolveCardIds).toHaveBeenCalledWith(
      { setCodes: ["woe"], query: "t:creature" },
      expect.any(AbortSignal),
    );
    expect(factory).toHaveBeenCalledWith(
      target,
      expect.objectContaining({ allowedCardIds: ["print-1", "print-2"] }),
      expect.any(Object),
    );
    expect(applet.start).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it("recreates the applet when the filter changes", async () => {
    const applets = [new FakeApplet(), new FakeApplet()];
    const target = { replaceChildren: vi.fn() } as unknown as HTMLElement;
    let appletIndex = 0;
    const factory: AppletFactory = vi.fn(async (_target: HTMLElement, _options: ScannerOptions, _callbacks: ScannerCallbacks) => applets[appletIndex++]);
    const resolveCardIds = vi.fn(async (catalog: { setCodes: readonly string[] }) => [catalog.setCodes[0]]);
    const controller = new ScannerController(
      target,
      {
        camera: {},
        catalog: { setCodes: ["woe"], query: "" },
        threshold: 0.5,
        ignoreZones: [],
      },
      events,
      factory,
      resolveCardIds,
    );

    controller.start();
    await controller.idle;
    controller.setCatalog({ setCodes: ["mom"], query: "" });
    await controller.idle;

    expect(applets[0].dispose).toHaveBeenCalledOnce();
    expect(applets[1].start).toHaveBeenCalledOnce();
    expect(vi.mocked(factory).mock.calls[1][1].allowedCardIds).toEqual(["mom"]);
    controller.dispose();
  });

  it("applies zone changes made while an applet is loading and after it starts", async () => {
    const applet = new FakeApplet();
    let finish!: (applet: Applet) => void;
    const loading = new Promise<Applet>((resolve) => { finish = resolve; });
    const factory: AppletFactory = vi.fn(() => loading);
    const controller = new ScannerController(
      { replaceChildren: vi.fn() } as unknown as HTMLElement,
      { camera: {}, catalog: { setCodes: [], query: "" }, threshold: 0.5, ignoreZones: [] },
      events, factory, vi.fn(),
    );
    controller.start();
    await Promise.resolve();
    const zone = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } as const;
    controller.setIgnoreZones([zone]);
    finish(applet);
    await controller.idle;
    expect(applet.updateConfig).toHaveBeenCalledWith({ ignoreZones: [zone] });
    controller.setIgnoreZones([]);
    expect(applet.updateConfig).toHaveBeenLastCalledWith({ ignoreZones: [] });
    controller.dispose();
  });
});
