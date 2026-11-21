import { parseOverlayState } from "./overlayState";
import type { CardInfo } from "./scryfall";

export interface ObsConnectionSettings {
  port: number;
  password: string;
}

export interface CardTracking {
  type: "tracking";
  sessionId: string;
  cardId: string;
  corners: readonly [number, number][];
}

export interface CardUpdate {
  type: "card";
  sessionId: string;
  card: CardInfo | null;
  confidence: number | null;
}

export interface OverlayReady {
  type: "ready";
  sessionId: string;
}

export interface SettingsUpdate {
  type: "settings";
  sessionId: string;
  settings: string;
}

export type ObsOverlayEvent = CardTracking | CardUpdate | OverlayReady | SettingsUpdate;

export type ObsConnectionStatus =
  | { state: "connecting" }
  | { state: "connected" }
  | { state: "disconnected" }
  | { state: "error"; message: string };

export const DEFAULT_OBS_PORT = 4455;
const EVENT_SOURCE = "obs-mtg-scanner";
const RECONNECT_DELAY_MS = 1500;
const MAX_BUFFERED_BYTES = 64 * 1024;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1);
}

/** Wire format shared by OBS broadcasts and the scanner app's postMessage feed to its preview iframe. */
export function toOverlayEventData(event: ObsOverlayEvent): Record<string, unknown> {
  return { source: EVENT_SOURCE, ...event };
}

export function parseObsOverlayEvent(value: unknown): ObsOverlayEvent | null {
  if (!isObject(value) || value.source !== EVENT_SOURCE || typeof value.sessionId !== "string") return null;

  if (value.type === "ready") {
    return { type: "ready", sessionId: value.sessionId };
  }

  if (value.type === "settings") {
    if (typeof value.settings !== "string" || value.settings.length > 4096) return null;
    return { type: "settings", sessionId: value.sessionId, settings: value.settings };
  }

  if (value.type === "tracking") {
    if (typeof value.cardId !== "string" || !Array.isArray(value.corners) || value.corners.length !== 4) return null;
    if (!value.corners.every(isPoint)) return null;
    return {
      type: "tracking",
      sessionId: value.sessionId,
      cardId: value.cardId,
      corners: value.corners as [number, number][],
    };
  }

  if (value.type === "card") {
    const state = parseOverlayState({ card: value.card, confidence: value.confidence });
    if (!state) return null;
    return { type: "card", sessionId: value.sessionId, card: state.card, confidence: state.confidence };
  }

  return null;
}

export function parseObsConnectionSettings(hash: string, fallbackPassword = ""): ObsConnectionSettings {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const port = Number(params.get("obsPort"));
  return {
    port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_OBS_PORT,
    password: params.get("obsPassword") ?? fallbackPassword,
  };
}

export const MASKED_OBS_PASSWORD = "••••••••";

export function serializeObsConnectionSettings(
  settings: ObsConnectionSettings,
  { password = "omit" }: { password?: "omit" | "include" | "mask" } = {},
): string {
  const params = new URLSearchParams();
  if (settings.port !== DEFAULT_OBS_PORT) params.set("obsPort", String(settings.port));
  if (password === "include" && settings.password) params.set("obsPassword", settings.password);
  const fragment = params.toString();
  if (password !== "mask" || !settings.password) return fragment;
  // Appended unencoded so the preview shows bullets; its fixed length hides the real password length.
  return `${fragment ? `${fragment}&` : ""}obsPassword=${MASKED_OBS_PASSWORD}`;
}

async function sha256Base64(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

interface ObsWebSocketMessage {
  op?: number;
  d?: Record<string, unknown>;
}

export class ObsWebSocketClient {
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private stopped = true;
  private settings: ObsConnectionSettings;

  constructor(
    settings: ObsConnectionSettings,
    private readonly onStatus: (status: ObsConnectionStatus) => void,
    private readonly onEvent: (event: ObsOverlayEvent) => void = () => {},
  ) {
    this.settings = settings;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  configure(settings: ObsConnectionSettings): void {
    if (settings.port === this.settings.port && settings.password === this.settings.password) return;
    this.settings = settings;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
    if (!this.stopped) this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  broadcast(event: ObsOverlayEvent): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > MAX_BUFFERED_BYTES) return;

    socket.send(JSON.stringify({
      op: 6,
      d: {
        requestType: "BroadcastCustomEvent",
        requestId: `mtg-${++this.requestId}`,
        requestData: {
          eventData: toOverlayEventData(event),
        },
      },
    }));
  }

  private connect(): void {
    if (this.stopped) return;
    this.onStatus({ state: "connecting" });

    try {
      const socket = new WebSocket(`ws://localhost:${this.settings.port}`);
      this.socket = socket;
      socket.onmessage = (message) => void this.handleMessage(socket, message);
      socket.onerror = () => socket.close();
      socket.onclose = (event) => {
        if (this.socket !== socket || this.stopped) return;
        this.socket = null;
        this.onStatus({
          state: "error",
          message: event.reason || "OBS WebSocket disconnected. Check its server settings and password.",
        });
        this.scheduleReconnect();
      };
    } catch (error) {
      this.onStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      this.scheduleReconnect();
    }
  }

  private async handleMessage(socket: WebSocket, message: MessageEvent): Promise<void> {
    if (this.socket !== socket || typeof message.data !== "string") return;
    let response: ObsWebSocketMessage;
    try {
      response = JSON.parse(message.data) as ObsWebSocketMessage;
    } catch (error) {
      console.error("Ignoring invalid OBS WebSocket message", error);
      return;
    }

    const data = response.d;
    if (!data) return;

    if (response.op === 0) {
      const authentication = data.authentication;
      if (isObject(authentication)) {
        const salt = authentication.salt;
        const challenge = authentication.challenge;
        if (typeof salt !== "string" || typeof challenge !== "string") {
          socket.close();
          return;
        }
        try {
          const secret = await sha256Base64(this.settings.password + salt);
          data.authentication = await sha256Base64(secret + challenge);
        } catch (error) {
          this.onStatus({
            state: "error",
            message: error instanceof Error ? error.message : String(error),
          });
          socket.close();
          return;
        }
      }

      if (this.socket !== socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({
        op: 1,
        d: {
          rpcVersion: data.rpcVersion,
          eventSubscriptions: 1,
          ...(data.authentication ? { authentication: data.authentication } : {}),
        },
      }));
      return;
    }

    if (response.op === 2) {
      this.onStatus({ state: "connected" });
      return;
    }

    if (response.op === 5 && data.eventType === "CustomEvent") {
      const event = parseObsOverlayEvent(data.eventData);
      if (event) this.onEvent(event);
    }

    if (response.op === 7 && data.requestType === "BroadcastCustomEvent") {
      const requestStatus = data.requestStatus;
      if (isObject(requestStatus) && requestStatus.result === false) {
        const comment = typeof requestStatus.comment === "string" ? requestStatus.comment : "OBS rejected the custom event.";
        this.onStatus({ state: "error", message: comment });
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
}
