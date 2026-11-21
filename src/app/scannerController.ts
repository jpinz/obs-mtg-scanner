import type { Applet, CardDetection, ScanResult, ScannerCallbacks, ScannerOptions } from "./scanner";

export type CameraState = "off" | "starting" | "on";

export type ModelStatus =
  | { kind: "loading"; message: string }
  | { kind: "ready"; inferenceMode?: string; numThreads?: number };

export interface CatalogSpec {
  setCodes: readonly string[];
  query: string;
}

export interface ControllerOptions {
  camera: MediaTrackConstraints;
  catalog: CatalogSpec;
  threshold: number;
}

const catalogKey = (catalog: CatalogSpec) => JSON.stringify([catalog.setCodes, catalog.query]);

export interface ScannerEvents {
  onCameraState(state: CameraState): void;
  onModelStatus(status: ModelStatus): void;
  /** `null` clears a previous scanner or camera error. */
  onError(message: string | null): void;
  onResult(result: ScanResult): void;
  onCardDetected(card: CardDetection): void;
}

/** Builds an applet that loads models into `target` without opening the camera. */
export type AppletFactory = (target: HTMLElement, options: ScannerOptions, callbacks: ScannerCallbacks) => Promise<Applet>;
export type CardIdResolver = (catalog: CatalogSpec, signal: AbortSignal) => Promise<string[]>;

export function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Camera access was blocked. Allow it in the browser's site settings.";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "That camera isn't available. Pick another device.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is in use by another app. Close it there, or capture the camera in OBS and pick “OBS Virtual Camera” here.";
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Owns the CollectorVision applet and the webcam. Callers state what they want
 * (camera on/off, which device, which catalog); the controller converges on it
 * one step at a time, so rapid clicks and setting changes can't race each other.
 */
export class ScannerController {
  private applet: Applet | null = null;
  private loadedCatalog: string | null = null;
  private runningCamera: MediaTrackConstraints | null = null;
  private wanted = false;
  private disposed = false;
  private queue: Promise<void> = Promise.resolve();
  private catalogRequest: AbortController | null = null;

  constructor(
    private readonly target: HTMLElement,
    private readonly options: ControllerOptions,
    private readonly events: ScannerEvents,
    private readonly createApplet: AppletFactory,
    private readonly resolveCardIds: CardIdResolver,
  ) {}

  /** Settles once every requested change so far has been applied. */
  get idle(): Promise<void> {
    return this.queue;
  }

  start(): void {
    this.wanted = true;
    this.schedule();
  }

  stop(): void {
    this.wanted = false;
    this.stopCamera();
    this.schedule();
  }

  setCamera(camera: MediaTrackConstraints): void {
    this.options.camera = camera;
    this.schedule();
  }

  /** The catalog is loaded by the scanner worker at startup, so changing it rebuilds the applet. */
  setCatalog(catalog: CatalogSpec): void {
    this.options.catalog = catalog;
    this.catalogRequest?.abort();
    this.schedule();
  }

  setThreshold(threshold: number): void {
    this.options.threshold = threshold;
    this.applet?.updateConfig({ matchThreshold: threshold });
  }

  dispose(): void {
    this.disposed = true;
    this.wanted = false;
    this.catalogRequest?.abort();
    this.disposeApplet();
  }

  private schedule(): void {
    this.queue = this.queue.then(() => this.reconcile());
  }

  private async reconcile(): Promise<void> {
    if (this.disposed) return;

    if (!this.applet || this.loadedCatalog !== catalogKey(this.options.catalog)) {
      if (!this.wanted && !this.applet) return;
      this.disposeApplet();
      this.events.onError(null);
      this.events.onModelStatus({
        kind: "loading",
        message: this.options.catalog.setCodes.length || this.options.catalog.query ? "Loading card list…" : "Loading card scanner…",
      });
      try {
        this.catalogRequest = new AbortController();
        const catalog = this.options.catalog;
        const allowedCardIds = catalog.setCodes.length || catalog.query
          ? await this.resolveCardIds(catalog, this.catalogRequest.signal)
          : undefined;
        if (this.catalogRequest.signal.aborted || this.disposed) return;
        this.events.onModelStatus({ kind: "loading", message: "Loading card scanner…" });
        const applet = await this.load(allowedCardIds);
        if (this.disposed || catalogKey(catalog) !== catalogKey(this.options.catalog)) {
          applet.dispose();
          this.schedule();
          return;
        }
        this.applet = applet;
        this.loadedCatalog = catalogKey(catalog);
      } catch (error) {
        if (this.catalogRequest?.signal.aborted || this.disposed) return;
        this.wanted = false;
        this.events.onError(error instanceof Error ? error.message : String(error));
        return;
      }
    }

    if (!this.wanted) {
      this.stopCamera();
      return;
    }
    if (this.runningCamera === this.options.camera) return;

    const applet = this.applet;
    const camera = this.options.camera;
    applet.stop();
    applet.config.camera = camera;
    this.events.onCameraState("starting");
    try {
      await applet.start();
    } catch (error) {
      applet.stop();
      this.runningCamera = null;
      this.wanted = false;
      this.events.onCameraState("off");
      this.events.onError(cameraErrorMessage(error));
      return;
    }
    if (this.disposed || applet !== this.applet) return;
    this.runningCamera = camera;
    this.events.onError(null);
    this.events.onCameraState("on");
    // A stop or device change may have arrived while the camera was opening.
    if (!this.wanted || camera !== this.options.camera) this.schedule();
  }

  private load(allowedCardIds: string[] | undefined): Promise<Applet> {
    // Ignore callbacks from an applet that has since been replaced.
    let current: Applet | null = null;
    const live = () => !this.disposed && (current === null || current === this.applet);
    return this.createApplet(
      this.target,
      {
        camera: this.options.camera,
        threshold: this.options.threshold,
        allowedCardIds,
      },
      {
      onProgress: (progress) => {
        if (live() && progress.ratio !== undefined && progress.stage !== "dewarp") {
          this.events.onModelStatus({
            kind: "loading",
            message: `Loading ${progress.stage}… ${Math.round(progress.ratio * 100)}%`,
          });
        }
      },
      onReady: (info) => live() && this.events.onModelStatus({ kind: "ready", ...info }),
      onResult: (result) => live() && this.events.onResult(result),
      onCardDetected: (card) => live() && this.events.onCardDetected(card),
      onError: (message) => live() && this.events.onError(message),
      },
    ).then((applet) => (current = applet));
  }

  private stopCamera(): void {
    this.applet?.stop();
    this.runningCamera = null;
    this.events.onCameraState("off");
  }

  private disposeApplet(): void {
    this.stopCamera();
    this.applet?.dispose();
    this.applet = null;
    this.loadedCatalog = null;
    this.target.replaceChildren();
  }
}
