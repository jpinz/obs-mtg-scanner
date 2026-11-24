import { Button } from "@kobalte/core/button";
import { Checkbox } from "@kobalte/core/checkbox";
import { createEffect, createMemo, createSignal, createStore, For, onSettled, snapshot } from "solid-js";
import { PREVIEW_PARAM, SESSION_PARAM } from "../overlayState";
import {
  DEFAULT_OBS_PORT,
  ObsWebSocketClient,
  parseObsOverlayEvent,
  serializeObsConnectionSettings,
  toOverlayEventData,
  type ObsConnectionSettings,
  type ObsConnectionStatus,
  type ObsOverlayEvent,
  type CardTracking,
} from "../obsWebSocket";
import { parsePreviewMessage, toPreviewMessageData } from "../previewMessages";
import { ScryfallClient, type CardInfo } from "../scryfall";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  DEFAULT_SETTINGS,
  DETAIL_FIELDS,
  DETAIL_FIELD_LABELS,
  FOLLOW_SIDES,
  parseSettings,
  serializeOverlaySettings,
  serializeSettings,
  setLayoutBox,
  TEXT_SIZE_RANGE,
  type DetailField,
  type FollowSide,
  type LayoutBox,
  type LayoutItem,
  type OverlaySettings,
} from "../settings";
import { CardFeed, isIgnoredCard } from "./cardFeed";
import { HistoryPanel } from "./HistoryPanel";
import { HISTORY_STORAGE_KEY, parseHistory, removeHistoryEntries, summarizeHistory, type HistoryEntry } from "./history";
import { IgnoreZoneEditor } from "./IgnoreZoneEditor";
import type { OverlaySession } from "./overlaySession";
import { cameraConstraints, createScanner } from "./scanner";
import { ScannerController, type CameraState, type CatalogSpec, type ModelStatus } from "./scannerController";

const STORAGE_KEY = "mtg-scanner:settings";
const OBS_STORAGE_KEY = "mtg-scanner:obs-websocket";
/** The overlay preview is laid out at this size and scaled down, so it matches a 1080p OBS canvas. */
const CANVAS = { width: 1920, height: 1080 };
const RESOLUTIONS = ["640x480", "1280x720", "1920x1080", "3840x2160"];
const DEFAULT_OBS_SETTINGS: ObsConnectionSettings = { port: DEFAULT_OBS_PORT, password: "" };
/** Minimum time between live layout updates sent to OBS while dragging. */
const LIVE_MOVE_INTERVAL_MS = 100;
const FOLLOW_SIDE_LABELS: Record<FollowSide, string> = {
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
};

type Option = { value: string; label: string };

function loadSettings(): OverlaySettings {
  if (window.location.search) return parseSettings(window.location.search);
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY) ?? "");
  } catch {
    return parseSettings("");
  }
}

function loadObsSettings(): ObsConnectionSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(OBS_STORAGE_KEY) ?? "null");
    if (typeof value !== "object" || value === null) return DEFAULT_OBS_SETTINGS;
    const settings = value as Partial<ObsConnectionSettings>;
    return {
      port: Number.isInteger(settings.port) && Number(settings.port) > 0 && Number(settings.port) <= 65535
        ? Number(settings.port)
        : DEFAULT_OBS_SETTINGS.port,
      password: typeof settings.password === "string" ? settings.password : "",
    };
  } catch {
    return DEFAULT_OBS_SETTINGS;
  }
}

function expandHex(color: string): string {
  return color.length === 4 ? `#${[...color.slice(1)].map((c) => c + c).join("")}` : color;
}

const asOptions = (values: readonly string[], label: (value: string) => string = (v) => v): Option[] =>
  values.map((value) => ({ value, label: label(value) }));

/** Serializes a list setting with `item` toggled, keeping `allowed` order; `none` means empty. */
function toggleListParam<T extends string>(allowed: readonly T[], current: readonly T[], item: T, on: boolean): string {
  const next = allowed.filter((value) => (value === item ? on : current.includes(value)));
  return next.length === 0 ? "none" : next.join(",");
}

function SelectField(props: { label: string; value: string; options: Option[]; onChange(value: string): void }) {
  return (
    <label>
      {props.label}
      <select onChange={(event) => props.onChange(event.currentTarget.value)}>
        {/* `selected` per option, since a select's value can't be set before its options exist. */}
        <For each={props.options} keyed={(option) => option.value}>
          {(option) => (
            <option value={option().value} selected={option().value === props.value}>
              {option().label}
            </option>
          )}
        </For>
      </select>
    </label>
  );
}

/** Optional px size override: empty means inherit, and the placeholder shows the inherited size. */
function TextSizeOverride(props: {
  id: string;
  label: string;
  value: number | null;
  inherited: number;
  disabled?: boolean;
  onChange(value: number | null): void;
}) {
  return (
    <div class="size-override">
      <label for={props.id}>{props.label}</label>
      <span class="size-override__input">
        <input
          id={props.id}
          type="number"
          inputmode="numeric"
          min={TEXT_SIZE_RANGE.min}
          max={TEXT_SIZE_RANGE.max}
          step="1"
          placeholder={String(props.inherited)}
          value={props.value ?? ""}
          disabled={props.disabled}
          onChange={(event) => {
            const n = event.currentTarget.valueAsNumber;
            if (!Number.isFinite(n)) event.currentTarget.value = "";
            props.onChange(Number.isFinite(n) ? n : null);
          }}
        />
        <span aria-hidden="true">px</span>
        <button
          type="button"
          class="size-override__clear"
          aria-label={`Use inherited size for ${props.label}`}
          title="Use inherited size"
          hidden={props.value === null}
          onClick={() => props.onChange(null)}
        >
          ×
        </button>
      </span>
    </div>
  );
}

function CheckField(props: { label: string; checked: boolean; disabled?: boolean; onChange(checked: boolean): void }) {
  return (
    <Checkbox class="check" checked={props.checked} disabled={props.disabled} onChange={props.onChange}>
      <Checkbox.Input class="check__input" />
      <Checkbox.Control class="check__control">
        <Checkbox.Indicator>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m3.5 8 3 3 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label class="check__label">{props.label}</Checkbox.Label>
    </Checkbox>
  );
}

export function App(props: { session: OverlaySession }) {
  const [settings, setSettings] = createStore<OverlaySettings>(loadSettings());
  const [obsSettings, setObsSettings] = createSignal<ObsConnectionSettings>(loadObsSettings());
  const [obsStatus, setObsStatus] = createSignal<ObsConnectionStatus>({ state: "disconnected" });
  const [cameraState, setCameraState] = createSignal<CameraState>("off");
  const [modelStatus, setModelStatus] = createSignal<ModelStatus>({ kind: "loading", message: "Loading card scanner…" });
  const [scannerError, setScannerError] = createSignal<string | null>(null);
  const [lookupError, setLookupError] = createSignal<string | null>(null);
  const [devices, setDevices] = createSignal<MediaDeviceInfo[]>([]);
  const [previewScale, setPreviewScale] = createSignal(1);
  const [copied, setCopied] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [editingZones, setEditingZones] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"settings" | "history">("settings");
  const [historyError, setHistoryError] = createSignal<string | null>(null);
  const [history, setHistory] = createSignal<HistoryEntry[]>(() => {
    try {
      return parseHistory(localStorage.getItem(HISTORY_STORAGE_KEY));
    } catch (error) {
      console.error("Could not load card history", error);
      setHistoryError("Could not load saved history. Changes may replace it.");
      return [];
    }
  });
  const scryfall = new ScryfallClient();
  // Sliders preview locally while dragging and commit on release.
  const [thresholdDraft, setThresholdDraft] = createSignal(() => settings.threshold);
  const [textSizeDraft, setTextSizeDraft] = createSignal(() => settings.textSize);

  let stage!: HTMLDivElement;
  let frame!: HTMLDivElement;
  let scanner: ScannerController | undefined;
  let feed: CardFeed | undefined;
  let obsConnection: ObsWebSocketClient | undefined;
  let previewFrame: HTMLIFrameElement | undefined;

  /** The preview iframe gets events directly, so it never needs its own OBS connection. */
  function sendToPreview(event: ObsOverlayEvent) {
    previewFrame?.contentWindow?.postMessage(toOverlayEventData(event), window.location.origin);
  }

  function publish(event: ObsOverlayEvent) {
    obsConnection?.broadcast(event);
    sendToPreview(event);
  }

  function updateHistory(next: HistoryEntry[]) {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      setHistoryError(null);
    } catch (error) {
      console.error("Could not save card history", error);
      setHistoryError("Could not save history in this browser. Changes will be lost on reload.");
    }
  }

  function addToHistory(card: CardInfo, addedAt = new Date().toISOString()) {
    updateHistory([{ id: crypto.randomUUID(), card, addedAt }, ...history()]);
  }

  function totalEvent(): ObsOverlayEvent {
    const { text, missing, count } = summarizeHistory(history(), settings.currency);
    return { type: "total", sessionId: props.session.sessionId, text, missing, count };
  }

  function sendEditState(on: boolean) {
    previewFrame?.contentWindow?.postMessage(toPreviewMessageData({ type: "edit", editing: on }), window.location.origin);
  }

  function applySettings(next: OverlaySettings) {
    setSettings((draft) => {
      for (const key of Object.keys(next) as (keyof OverlaySettings)[]) {
        // Only touch changed keys, so effects on unrelated settings don't re-run.
        if (JSON.stringify(draft[key]) !== JSON.stringify(next[key])) {
          (draft as Record<keyof OverlaySettings, unknown>)[key] = next[key];
        }
      }
    });
    publish({
      type: "settings",
      sessionId: props.session.sessionId,
      settings: serializeOverlaySettings(next).toString(),
    });
  }

  /** Form values go through the URL-param parser, so the UI gets the same validation as URLs. */
  function commit(param: string, value: string) {
    const params = serializeSettings(snapshot(settings));
    params.set(param, value);
    applySettings(parseSettings(params));
  }

  /** Applies a settings change after round-tripping it through the URL params for validation. */
  function commitSettings(update: Partial<OverlaySettings>) {
    applySettings(parseSettings(serializeSettings({ ...snapshot(settings), ...update })));
  }

  function layoutSettings(item: LayoutItem, box: LayoutBox): OverlaySettings {
    const current = snapshot(settings);
    return { ...current, layout: setLayoutBox(current.layout, item, box) };
  }

  function commitLayout(item: LayoutItem, box: LayoutBox) {
    commitSettings({ layout: layoutSettings(item, box).layout });
  }

  function resetLayout() {
    commitSettings({ layout: DEFAULT_SETTINGS.layout });
  }

  function commitDetailTextSize(field: DetailField, size: number | null) {
    const sizes = { ...snapshot(settings).detailTextSizes };
    if (size === null) delete sizes[field];
    else sizes[field] = size;
    commitSettings({ detailTextSizes: sizes });
  }

  const sizeParam = (size: number | null) => (size === null ? "" : String(size));
  const detailsBaseSize = () => settings.detailsTextSize ?? settings.textSize;

  function updateObsSettings(update: Partial<ObsConnectionSettings>) {
    const current = obsSettings();
    const next = { ...current, ...update };
    setObsSettings(next);
    try {
      localStorage.setItem(OBS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Settings still apply for this session when storage is unavailable.
    }
    obsConnection?.configure(next);
  }

  const overlayUrl = (password: "omit" | "include" | "mask", preview = false) => {
    const query = new URLSearchParams({ [SESSION_PARAM]: props.session.sessionId });
    if (preview) query.set(PREVIEW_PARAM, "1");
    const hash = serializeObsConnectionSettings(obsSettings(), { password });
    return `${new URL(`/overlay?${query}`, window.location.origin).href}${hash ? `#${hash}` : ""}`;
  };
  const previewUrl = createMemo(() => overlayUrl("omit", true));
  const obsUrl = createMemo(() => overlayUrl("include"));
  const obsUrlPreview = createMemo(() => overlayUrl("mask"));

  const cameraOptions = createMemo(() => {
    const options: Option[] = [{ value: "", label: "Default camera" }];
    devices().forEach((device, i) => {
      if (device.deviceId) options.push({ value: device.deviceId, label: device.label || `Camera ${i + 1}` });
    });
    if (settings.camera && !options.some((o) => o.value === settings.camera)) {
      options.push({ value: settings.camera, label: "Saved camera (not connected)" });
    }
    return options;
  });

  const resolution = createMemo(() => `${settings.resolution.width}x${settings.resolution.height}`);
  const resolutionOptions = createMemo(() =>
    asOptions(RESOLUTIONS.includes(resolution()) ? RESOLUTIONS : [...RESOLUTIONS, resolution()]),
  );

  const status = createMemo((): { text: string; error: boolean } => {
    const error = scannerError() ?? lookupError();
    if (error) return { text: error, error: true };
    const model = modelStatus();
    const camera = cameraState();
    if (camera === "starting") return { text: "Starting camera…", error: false };
    if (model.kind === "loading") return { text: model.message, error: false };
    if (camera === "off") return { text: "Camera off. Press “Start camera” to scan.", error: false };
    return {
      text: settings.debug
        ? `Scanning (${model.inferenceMode ?? "WASM"}, ${model.numThreads ?? 1} threads)`
        : "Scanning. Hold a card up to the camera.",
      error: false,
    };
  });

  const obsStatusText = createMemo(() => {
    const connection = obsStatus();
    if (connection.state === "connected") return "Connected";
    if (connection.state === "connecting") return "Connecting…";
    if (connection.state === "error") return connection.message;
    return "Waiting to connect";
  });

  createEffect(
    () => serializeSettings(settings).toString(),
    (query) => {
      try {
        localStorage.setItem(STORAGE_KEY, query);
      } catch {
        // Settings still apply for this session when storage is unavailable.
      }
    },
    { defer: true },
  );
  createEffect(() => settings.threshold, (threshold) => scanner?.setThreshold(threshold), { defer: true });
  createEffect(
    () => [settings.ignoreArtCards, settings.ignoreTokenCards, settings.ignoreNonPlayableCards],
    () => feed?.refreshIgnoreRules(),
    { defer: true },
  );
  createEffect(
    () => JSON.stringify(settings.ignoreZones),
    () => {
      feed?.clear();
      scanner?.setIgnoreZones(snapshot(settings).ignoreZones);
    },
    { defer: true },
  );
  createEffect(cameraState, (state) => {
    if (state !== "on") setEditingZones(false);
  }, { defer: true });
  createEffect(editing, (on) => sendEditState(on), { defer: true });
  createEffect(
    () => ({ entries: history(), currency: settings.currency }),
    () => publish(totalEvent()),
    { defer: true },
  );
  createEffect(
    () => settings.duration,
    (seconds) => {
      if (feed) feed.durationMs = seconds * 1000;
    },
    { defer: true },
  );
  createEffect(() => cameraConstraints(settings), (camera) => scanner?.setCamera(camera), { defer: true });
  createEffect(
    () => ({
      setCodes: settings.setCodes,
      query: settings.query,
    }),
    (catalog) => {
      feed?.clear();
      scanner?.setCatalog(catalog);
    },
    { defer: true },
  );

  async function refreshCameras() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((device) => device.kind === "videoinput"));
    } catch (error) {
      console.error("Listing cameras failed", error);
    }
  }

  function toggleCamera() {
    if (cameraState() === "off") {
      scanner?.start();
    } else {
      scanner?.stop();
      feed?.clear();
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(obsUrl());
    } catch {
      // The visible field is masked, so fall back to copying the real URL from an offscreen field.
      const field = document.createElement("textarea");
      field.value = obsUrl();
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const ok = document.execCommand("copy");
      field.remove();
      if (!ok) return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  onSettled(() => {
    let latestCard: CardInfo | null = null;
    let latestConfidence: number | null = null;
    let latestTracking: CardTracking | null = null;
    const publishSnapshot = (send: (event: ObsOverlayEvent) => void) => {
      send({
        type: "settings",
        sessionId: props.session.sessionId,
        settings: serializeOverlaySettings(settings).toString(),
      });
      send({
        type: "card",
        sessionId: props.session.sessionId,
        card: latestCard,
        confidence: latestConfidence,
      });
      send(totalEvent());
      if (latestTracking) send(latestTracking);
    };
    const connection = new ObsWebSocketClient(
      obsSettings(),
      (status) => {
        setObsStatus(status);
        if (status.state === "connected") publishSnapshot((event) => connection.broadcast(event));
      },
      (event) => {
        if (event.sessionId === props.session.sessionId && event.type === "ready") {
          publishSnapshot((event) => connection.broadcast(event));
        }
      },
    );
    obsConnection = connection;
    connection.start();
    let lastLiveMove = 0;
    const onPreviewMessage = (message: MessageEvent) => {
      if (message.origin !== window.location.origin || !previewFrame || message.source !== previewFrame.contentWindow) return;
      const previewMessage = parsePreviewMessage(message.data);
      if (previewMessage?.type === "layout") {
        if (previewMessage.done) {
          lastLiveMove = 0;
          commitLayout(previewMessage.item, previewMessage.box);
          return;
        }
        // Live OBS preview while moving or resizing; the preview updates itself and nothing is persisted until done.
        const now = performance.now();
        if (now - lastLiveMove < LIVE_MOVE_INTERVAL_MS) return;
        lastLiveMove = now;
        obsConnection?.broadcast({
          type: "settings",
          sessionId: props.session.sessionId,
          settings: serializeOverlaySettings(layoutSettings(previewMessage.item, previewMessage.box)).toString(),
        });
        return;
      }
      const event = parseObsOverlayEvent(message.data);
      if (event?.type === "ready" && event.sessionId === props.session.sessionId) {
        publishSnapshot(sendToPreview);
        // The iframe may have reloaded, so restore its edit mode.
        sendEditState(editing());
      }
    };
    window.addEventListener("message", onPreviewMessage);
    const cardFeed = new CardFeed(
      {
        lookup: (cardId, signal) => scryfall.getCard(cardId, signal),
        shouldIgnore: (card) => isIgnoredCard(card, settings),
        publish: (card, confidence) => {
          latestCard = card;
          latestConfidence = card ? confidence : null;
          if (!card) latestTracking = null;
          publish({ type: "card", sessionId: props.session.sessionId, card, confidence: latestConfidence });
        },
        onNewCard: addToHistory,
        onError: setLookupError,
      },
      settings.duration * 1000,
    );
    feed = cardFeed;

    const controller = new ScannerController(
      stage,
      {
        camera: cameraConstraints(settings),
        catalog: { setCodes: settings.setCodes, query: settings.query },
        threshold: settings.threshold,
        ignoreZones: snapshot(settings).ignoreZones,
      },
      {
        onCameraState: (state) => {
          setCameraState(state);
          // Device labels are only exposed after the user grants camera access.
          if (state === "on") void refreshCameras();
        },
        onModelStatus: setModelStatus,
        onError: setScannerError,
        onResult: (result) => {
          const now = performance.now();
          cardFeed.observe(result.cardPresent && result.cornersValid, now);
          if (
            result.cardPresent
            && result.cornersValid
            && result.cardId
            && result.cardId === cardFeed.cardId
            && result.score >= settings.threshold
            && result.corners.length === 4
          ) {
            latestTracking = {
              type: "tracking",
              sessionId: props.session.sessionId,
              cardId: result.cardId,
              corners: result.corners,
            };
            publish(latestTracking);
          }
        },
        onCardDetected: (card) => void cardFeed.detected(card.cardId, performance.now(), card.score),
      },
      createScanner,
      (catalog: CatalogSpec, signal) => scryfall.searchCardIds(catalog.query, catalog.setCodes, signal),
    );
    scanner = controller;

    latestCard = null;
    latestConfidence = null;
    latestTracking = null;
    publish({ type: "card", sessionId: props.session.sessionId, card: null, confidence: null });
    void refreshCameras();
    controller.start();

    const tick = setInterval(() => cardFeed.tick(performance.now()), 250);
    const onDeviceChange = () => void refreshCameras();
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);
    const resize = new ResizeObserver(() => setPreviewScale(frame.clientWidth / CANVAS.width));
    resize.observe(frame);

    return () => {
      clearInterval(tick);
      navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
      resize.disconnect();
      window.removeEventListener("message", onPreviewMessage);
      controller.dispose();
      connection.stop();
      obsConnection = undefined;
    };
  });

  return (
    <div class={["app", { mirror: settings.mirror, debug: settings.debug }]}>
      <header class="topbar">
        <div class="topbar__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="3" width="12" height="16" rx="2" />
            <path d="M8.5 3H17a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8.5" />
          </svg>
        </div>
        <div>
          <h1>MTG Card Scanner</h1>
          <p class="topbar__hint">Hold a card up to the camera. Add the overlay to OBS as a Browser Source.</p>
        </div>
      </header>
      <main class="layout">
        <section class="preview" aria-labelledby="preview-title">
          <div class="preview__heading">
            <div>
              <h2 id="preview-title">Camera preview</h2>
              <p>Video stays in this browser. Preview includes your OBS overlay.</p>
            </div>
            <div class="preview__actions">
              {editing() && (
                <Button type="button" class="button button--secondary" onClick={resetLayout}>
                  Reset layout
                </Button>
              )}
              <Button
                type="button"
                class="button button--secondary"
                aria-pressed={editing() ? "true" : "false"}
                onClick={() => {
                  setEditingZones(false);
                  setEditing((on) => !on);
                }}
              >
                {editing() ? "Done editing" : "Edit layout"}
              </Button>
              <Button
                type="button"
                class="button button--secondary"
                disabled={cameraState() !== "on"}
                aria-pressed={editingZones() ? "true" : "false"}
                onClick={() => {
                  setEditing(false);
                  setEditingZones((on) => !on);
                }}
              >
                {editingZones() ? "Done with zones" : "Ignore zones"}
              </Button>
              <Button
                type="button"
                class={["button", { "button--primary": cameraState() === "off", "button--secondary": cameraState() !== "off" }]}
                onClick={toggleCamera}
              >
                {cameraState() === "off" ? "Start camera" : "Stop camera"}
              </Button>
            </div>
          </div>
          <div class={["preview__frame", { "preview__frame--editing": editing() }]} ref={frame}>
            <div class="stage" ref={stage} />
            <div class={["preview__empty", { "preview__empty--hidden": cameraState() === "on" }]} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="13" height="12" rx="2" />
                <path d="m16 10 5-3v10l-5-3z" />
              </svg>
              <strong>{cameraState() === "starting" ? "Starting camera…" : "Camera is off"}</strong>
              <span>
                {cameraState() === "starting" ? "Waiting for camera access." : "Start your camera to see the preview here."}
              </span>
            </div>
            <iframe
              ref={previewFrame}
              class="preview__overlay"
              title="Overlay preview"
              tabindex={editing() ? "0" : "-1"}
              src={previewUrl()}
              style={{ transform: `scale(${previewScale()})` }}
            />
          </div>
          {editingZones() && (
            <IgnoreZoneEditor
              frame={frame}
              mirror={settings.mirror}
              zones={settings.ignoreZones}
              onChange={(ignoreZones) => commitSettings({ ignoreZones })}
              onDone={() => setEditingZones(false)}
            />
          )}
          <p class="preview__hint" hidden={!editing()}>
            Drag the card picture, name, details, and total to position them on the OBS canvas.
          </p>
          <p
            class={[
              "status",
              {
                "status--error": status().error,
                "status--active": !status().error && cameraState() === "on" && modelStatus().kind === "ready",
              },
            ]}
            role="status"
          >
            <span class="status__dot" aria-hidden="true" />
            {status().text}
          </p>

          <section class="source" aria-labelledby="source-title">
            <div class="source__heading">
              <div>
                <h2 id="source-title">OBS Browser Source</h2>
                <p>Copy this URL into an OBS Browser Source.</p>
              </div>
              <span class="source__resolution">{CANVAS.width} × {CANVAS.height}</span>
            </div>
            <div class="copy">
              <input type="text" readonly aria-label="OBS Browser Source URL" value={obsUrlPreview()} />
              <Button type="button" class="button button--secondary" onClick={() => void copyUrl()}>
                {copied() ? "Copied" : "Copy URL"}
              </Button>
            </div>
            <p class="help">
              Card data stays on this computer. The copied URL includes the OBS password so the Browser Source can log in automatically; treat it as a secret.
            </p>
            <fieldset class="obs-connection">
              <legend>Local OBS WebSocket</legend>
              <label>
                Port
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={obsSettings().port}
                  onChange={(event) => {
                    const port = event.currentTarget.valueAsNumber;
                    if (Number.isInteger(port) && port > 0 && port <= 65535) updateObsSettings({ port });
                  }}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autocomplete="new-password"
                  value={obsSettings().password}
                  onChange={(event) => updateObsSettings({ password: event.currentTarget.value })}
                />
              </label>
              <p class="help" role="status">
                OBS WebSocket: {obsStatusText()}
              </p>
              <p class="help">In OBS, enable the WebSocket server in Tools → WebSocket Server Settings. Enter its password here, then copy the URL again. Your browser may ask permission to connect to the local network.</p>
            </fieldset>
          </section>
        </section>

        <aside class="sidebar">
          <div class="tabs" role="tablist" aria-label="Scanner panels">
            <button type="button" role="tab" id="settings-tab" aria-controls="settings-panel" aria-selected={activeTab() === "settings" ? "true" : "false"}
              tabindex={activeTab() === "settings" ? 0 : -1}
              onClick={() => setActiveTab("settings")}
              onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); setActiveTab("history"); document.getElementById("history-tab")?.focus(); } }}>Settings</button>
            <button type="button" role="tab" id="history-tab" aria-controls="history-panel" aria-selected={activeTab() === "history" ? "true" : "false"}
              tabindex={activeTab() === "history" ? 0 : -1}
              onClick={() => setActiveTab("history")}
              onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); setActiveTab("settings"); document.getElementById("settings-tab")?.focus(); } }}>History <span>{history().length}</span></button>
          </div>
          <div id="history-panel" role="tabpanel" aria-labelledby="history-tab" hidden={activeTab() !== "history"}>
            <p class="history__error" role="alert" hidden={!historyError()}>{historyError()}</p>
            <HistoryPanel entries={history()} currency={settings.currency} client={scryfall}
              onAdd={addToHistory}
              onReplace={(id, card) => updateHistory(history().map((entry) => entry.id === id ? { ...entry, card } : entry))}
              onRemove={(ids) => updateHistory(removeHistoryEntries(history(), ids))}
            />
          </div>
        <form id="settings-panel" role="tabpanel" aria-labelledby="settings-tab" hidden={activeTab() !== "settings"} class="controls" autocomplete="off" onSubmit={(event) => event.preventDefault()}>
          <div class="controls__heading">
            <h2>Scanner settings</h2>
            <p>Changes apply automatically.</p>
          </div>
          <div class="control-group">
            <fieldset>
              <legend>Camera</legend>
              <SelectField
                label="Device"
                value={settings.camera}
                options={cameraOptions()}
                onChange={(value) => commit("camera", value)}
              />
              <SelectField
                label="Resolution"
                value={resolution()}
                options={resolutionOptions()}
                onChange={(value) => commit("res", value)}
              />
              <CheckField label="Mirror preview" checked={settings.mirror} onChange={(on) => commit("mirror", on ? "1" : "0")} />
            </fieldset>
          </div>

          <div class="control-group">
            <fieldset>
              <legend>Recognition</legend>
              <div class="range-field">
                <div class="field__heading">
                  <label for="match-threshold">Match threshold</label>
                  <output for="match-threshold">{thresholdDraft().toFixed(2)}</output>
                </div>
                <input
                  id="match-threshold"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={thresholdDraft()}
                  onInput={(event) => setThresholdDraft(event.currentTarget.valueAsNumber)}
                  onChange={(event) => commit("threshold", event.currentTarget.value)}
                />
              </div>
              <label>
                Card details stay for (seconds, 0 = until next card)
                <input
                  type="number"
                  min="0"
                  max="3600"
                  step="1"
                  value={settings.duration}
                  onChange={(event) => commit("duration", event.currentTarget.value)}
                />
              </label>
              <label>
                Set codes (comma-separated)
                <input
                  type="text"
                  placeholder="woe,mom"
                  value={settings.setCodes.join(",")}
                  onChange={(event) => commit("setcode", event.currentTarget.value)}
                />
              </label>
              <label>
                Scryfall search query
                <input
                  type="text"
                  placeholder="t:creature"
                  value={settings.query}
                  onChange={(event) => commit("query", event.currentTarget.value)}
                />
              </label>
              <fieldset class="subgroup check-list">
                <legend>Ignore recognized cards</legend>
                <CheckField
                  label="Ignore art cards"
                  checked={settings.ignoreArtCards}
                  onChange={(on) => commit("ignoreart", on ? "1" : "0")}
                />
                <CheckField
                  label="Ignore token cards"
                  checked={settings.ignoreTokenCards}
                  onChange={(on) => commit("ignoretokens", on ? "1" : "0")}
                />
                <CheckField
                  label="Ignore non-playable cards"
                  checked={settings.ignoreNonPlayableCards}
                  onChange={(on) => commit("ignoreunplayable", on ? "1" : "0")}
                />
                <p class="help">Cards with no legal or restricted Scryfall format include art cards and tokens. Ignored cards are not shown or added to history automatically.</p>
              </fieldset>
            </fieldset>
          </div>

          <div class="control-group">
            <fieldset>
              <legend>Overlay</legend>
              <SelectField
                label="Price"
                value={settings.currency}
                options={asOptions(CURRENCIES, (c) => CURRENCY_LABELS[c as (typeof CURRENCIES)[number]])}
                onChange={(value) => commit("currency", value)}
              />
              <CheckField
                label="Show all available finishes"
                checked={settings.allFinishes}
                onChange={(on) => commit("finishes", on ? "1" : "0")}
              />
              <CheckField label="Show total value" checked={settings.showTotal} onChange={(on) => commit("total", on ? "1" : "0")} />
              <SelectField
                label="Theme"
                value={settings.theme}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
                onChange={(value) => commit("theme", value)}
              />
              <label>
                Accent color
                <input
                  type="color"
                  value={expandHex(settings.accent)}
                  onChange={(event) => commit("accent", event.currentTarget.value)}
                />
              </label>
              <div class="range-field">
                <div class="field__heading">
                  <label for="text-size">Text size</label>
                  <output for="text-size">{textSizeDraft()} px</output>
                </div>
                <input
                  id="text-size"
                  type="range"
                  min={TEXT_SIZE_RANGE.min}
                  max={TEXT_SIZE_RANGE.max}
                  step="1"
                  value={textSizeDraft()}
                  onInput={(event) => setTextSizeDraft(event.currentTarget.valueAsNumber)}
                  onChange={(event) => commit("ts", event.currentTarget.value)}
                />
              </div>
              <CheckField label="Debug info" checked={settings.debug} onChange={(on) => commit("debug", on ? "1" : "0")} />

              <fieldset class="subgroup">
                <legend>Pinned card details</legend>
                <CheckField label="Card picture" checked={settings.showImage} onChange={(on) => commit("image", on ? "1" : "0")} />
                <CheckField label="Card name" checked={settings.showName} onChange={(on) => commit("name", on ? "1" : "0")} />
                <CheckField label="Card details" checked={settings.showDetails} onChange={(on) => commit("info", on ? "1" : "0")} />
                <fieldset class="check-list">
                  <legend>Details shown</legend>
                  <For each={[...DETAIL_FIELDS]} keyed={(field) => field}>
                    {(field) => (
                      <CheckField
                        label={DETAIL_FIELD_LABELS[field()]}
                        checked={settings.details.includes(field())}
                        onChange={(on) => commit("details", toggleListParam(DETAIL_FIELDS, settings.details, field(), on))}
                      />
                    )}
                  </For>
                </fieldset>
                <fieldset class="size-overrides">
                  <legend>Text sizes</legend>
                  <p class="help">Leave empty to use the inherited size shown.</p>
                  <TextSizeOverride
                    id="name-text-size"
                    label="Name"
                    value={settings.nameTextSize}
                    inherited={Math.round(settings.textSize * 1.25)}
                    onChange={(size) => commit("nts", sizeParam(size))}
                  />
                  <TextSizeOverride
                    id="details-text-size"
                    label="Details"
                    value={settings.detailsTextSize}
                    inherited={settings.textSize}
                    onChange={(size) => commit("dts", sizeParam(size))}
                  />
                  <For each={[...DETAIL_FIELDS]} keyed={(field) => field}>
                    {(field) => (
                      <TextSizeOverride
                        id={`detail-text-size-${field()}`}
                        label={DETAIL_FIELD_LABELS[field()]}
                        value={settings.detailTextSizes[field()] ?? null}
                        inherited={field() === "price" ? detailsBaseSize() : Math.round(detailsBaseSize() * 0.8)}
                        disabled={!settings.details.includes(field())}
                        onChange={(size) => commitDetailTextSize(field(), size)}
                      />
                    )}
                  </For>
                </fieldset>
              </fieldset>

              <fieldset class="subgroup">
                <legend>Follow panel</legend>
                <CheckField label="Follow the card" checked={settings.follow} onChange={(on) => commit("follow", on ? "1" : "0")} />
                <fieldset class="check-list">
                  <legend>Sides</legend>
                  <For each={[...FOLLOW_SIDES]} keyed={(side) => side}>
                    {(side) => (
                      <CheckField
                        label={FOLLOW_SIDE_LABELS[side()]}
                        checked={settings.followSides.includes(side())}
                        disabled={!settings.follow}
                        onChange={(on) => commit("sides", toggleListParam(FOLLOW_SIDES, settings.followSides, side(), on))}
                      />
                    )}
                  </For>
                </fieldset>
                <TextSizeOverride
                  id="follow-text-size"
                  label="Text size"
                  value={settings.followTextSize}
                  inherited={settings.textSize}
                  disabled={!settings.follow}
                  onChange={(size) => commit("fts", sizeParam(size))}
                />
                <p class="help">Shows a compact panel beside the tracked card, on the enabled side with the most free space.</p>
              </fieldset>
            </fieldset>
          </div>
        </form>
        </aside>
      </main>
    </div>
  );
}
