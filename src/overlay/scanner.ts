import type { OverlaySettings } from "../settings";

/** Subset of CollectorVision's scanner-applet `result` event payload that the overlay relies on. */
export interface ScanResult {
  cardPresent: boolean;
  cornersValid: boolean;
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

interface Applet extends EventTarget {
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

export async function startScanner(
  target: HTMLElement,
  settings: OverlaySettings,
  callbacks: ScannerCallbacks,
): Promise<Applet> {
  const module = (await import(/* @vite-ignore */ appletModuleUrl())) as AppletModule;
  return module.createCollectorVisionScannerApplet({
    target,
    matchThreshold: settings.threshold,
    catalogMode: settings.catalog,
    consecutiveMatches: 2,
    cooldownMs: 1500,
    // Same cadence as the hosted demo; the applet skips ticks while the worker is busy.
    scanIntervalMs: 50,
    groupBySecondaryId: false,
    overlay: settings.debug,
    showFpsOverlay: settings.debug,
    camera: cameraConstraints(settings),
    onReady: (info: { inferenceMode?: string; numThreads?: number }) => callbacks.onReady(info),
    onProgress: (progress: ScannerProgress) => callbacks.onProgress(progress),
    onResult: (result: ScanResult) => callbacks.onResult(result),
    onCardDetected: (card: CardDetection) => callbacks.onCardDetected(card),
    onError: ({ message }: { message: string }) => callbacks.onError(message),
  });
}
