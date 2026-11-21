import type { IgnoreZone, OverlaySettings } from "../settings";

/** Subset of CollectorVision's scanner-applet `result` event payload that the overlay relies on. */
export interface ScanResult {
  cardPresent: boolean;
  cornersValid: boolean;
  corners: readonly [number, number][];
  cardId: string | null;
  secondaryId?: string | null;
  score: number;
}

export interface CardDetection {
  cardId: string;
  secondaryId: string | null;
  score: number;
}

export interface ScannerProgress {
  stage: string;
  ratio?: number;
  inferenceMode?: string;
}

export interface Applet extends EventTarget {
  config: { camera: MediaTrackConstraints };
  /** Opens the camera from `config.camera` and starts scanning. */
  start(): Promise<void>;
  stop(): void;
  updateConfig(config: { matchThreshold?: number; ignoreZones?: readonly IgnoreZone[] }): void;
  dispose(): void;
}

interface AppletModule {
  createCollectorVisionScannerApplet(config: Record<string, unknown>): Promise<Applet>;
}

export interface ScannerCallbacks {
  onReady(info: { inferenceMode?: string; numThreads?: number }): void;
  onProgress(progress: ScannerProgress): void;
  onResult(result: ScanResult): void;
  onCardDetected(card: CardDetection): void;
  onError(message: string): void;
}

export interface ScannerOptions {
  camera: MediaTrackConstraints;
  threshold: number;
  ignoreZones: readonly IgnoreZone[];
  /** Restricts recognition to these Scryfall print IDs; omit to match the whole catalog. */
  allowedCardIds?: readonly string[];
}

export function appletModuleUrl(baseUri: string = document.baseURI): string {
  return new URL("collectorvision/lib/collectorvision-scanner-applet.mjs", baseUri).href;
}

export function cameraConstraints(settings: OverlaySettings): MediaTrackConstraints {
  return {
    // Overrides the applet's default `environment` facing mode, which is meant for phones.
    facingMode: undefined,
    deviceId: settings.camera ? { exact: settings.camera } : undefined,
    width: { ideal: settings.resolution.width },
    height: { ideal: settings.resolution.height },
  };
}

/** Loads the models without opening the camera; call `start()` on the result to begin scanning. */
export async function createScanner(
  target: HTMLElement,
  options: ScannerOptions,
  callbacks: ScannerCallbacks,
): Promise<Applet> {
  const module = (await import(/* @vite-ignore */ appletModuleUrl())) as AppletModule;
  return module.createCollectorVisionScannerApplet({
    target,
    autoStart: false,
    matchThreshold: options.threshold,
    ignoreZones: options.ignoreZones,
    allowedCardIds: options.allowedCardIds,
    consecutiveMatches: 2,
    cooldownMs: 1500,
    // Same cadence as the hosted demo; the applet skips ticks while the worker is busy.
    scanIntervalMs: 50,
    groupBySecondaryId: false,
    // The detection outline and FPS counter are always drawn; CSS shows them only in debug mode.
    overlay: true,
    showFpsOverlay: true,
    camera: options.camera,
    onReady: (info: { inferenceMode?: string; numThreads?: number }) => callbacks.onReady(info),
    onProgress: (progress: ScannerProgress) => callbacks.onProgress(progress),
    onResult: (result: ScanResult) => callbacks.onResult(result),
    onCardDetected: (card: CardDetection) => callbacks.onCardDetected(card),
    onError: ({ message }: { message: string }) => callbacks.onError(message),
  });
}
