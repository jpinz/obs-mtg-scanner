import { createEffect, createMemo, createSignal, onSettled, Show } from "solid-js";
import {
  ObsWebSocketClient,
  parseObsConnectionSettings,
  parseObsOverlayEvent,
  toOverlayEventData,
  type ObsOverlayEvent,
} from "../obsWebSocket";
import { parsePreviewMessage, toPreviewMessageData } from "../previewMessages";
import type { CardInfo } from "../scryfall";
import { LAYOUT_ITEMS, parseSettings, type LayoutBox, type LayoutItem, type OverlaySettings } from "../settings";
import { moveLayoutBox, resizeLayoutBox, sameLayoutBox, type Point } from "./dragPosition";
import { FollowPanel } from "./FollowPanel";
import type { Size } from "./followPlacement";
import { CardDetails, CardImage, CardName, useShownCard } from "./Panel";
import { Pinned, type DragMode } from "./Pinned";
import { SAMPLE_CARD, SAMPLE_CORNERS } from "./sampleCard";

/** The follow panel hides when the scanner stops sending tracking updates for this long. */
const TRACKING_TIMEOUT_MS = 1000;
/** Card picture width / height. */
const CARD_ASPECT = 488 / 680;
/** A dropped or resized component keeps its local box until the app echoes it back in settings, or this long. */
const SETTLE_TIMEOUT_MS = 1500;

type LayoutOverrides = Partial<Record<LayoutItem, LayoutBox>>;

interface DragState {
  item: LayoutItem;
  mode: DragMode;
  element: HTMLElement;
  pointerId: number;
  /** Pointer position when the drag started, in canvas px. */
  origin: Point;
  start: LayoutBox;
  box: LayoutBox | null;
  frame: number;
}

/** The scanner page broadcasts card details and camera-relative corners directly through OBS. */
export function Overlay(props: { settings: OverlaySettings; sessionId: string | null; preview?: boolean }) {
  const [settings, setSettings] = createSignal(props.settings);
  const [card, setCard] = createSignal<CardInfo | null>(null);
  const [confidence, setConfidence] = createSignal<number | null>(null);
  const [cardId, setCardId] = createSignal<string | null>(null);
  const [corners, setCorners] = createSignal<readonly [number, number][] | null>(null);
  const [tracking, setTracking] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [overrides, setOverrides] = createSignal<LayoutOverrides>({});
  const [dragging, setDragging] = createSignal<{ item: LayoutItem; mode: DragMode } | null>(null);
  const [canvas, setCanvas] = createSignal<Size>({ width: window.innerWidth, height: window.innerHeight });
  const [connected, setConnected] = createSignal(false);
  const [connectionMessage, setConnectionMessage] = createSignal("Connecting to OBS…");
  const hash = window.location.hash;
  const port = parseObsConnectionSettings(hash).port;
  const [password, setPassword] = createSignal(parseObsConnectionSettings(hash, loadObsPassword(port)).password);
  let connection: ObsWebSocketClient | undefined;
  let trackingTimer: ReturnType<typeof setTimeout> | undefined;
  let overrideMap: LayoutOverrides = {};
  const settleTimers = new Map<LayoutItem, ReturnType<typeof setTimeout>>();
  let drag: DragState | null = null;

  createEffect(
    () => settings(),
    (current) => {
      document.documentElement.dataset.theme = current.theme;
      document.documentElement.style.setProperty("--accent", current.accent);
    },
  );

  function submitPassword(event: SubmitEvent) {
    event.preventDefault();
    const value = password();
    try {
      localStorage.setItem(passwordStorageKey(port), value);
    } catch (error) {
      console.warn("Could not save the OBS WebSocket password in this browser", error);
    }
    connection?.configure({ port, password: value });
  }

  function stopTracking() {
    clearTimeout(trackingTimer);
    trackingTimer = undefined;
    setTracking(false);
  }

  function setOverride(item: LayoutItem, box: LayoutBox | null) {
    const next = { ...overrideMap };
    if (box) next[item] = box;
    else delete next[item];
    overrideMap = next;
    setOverrides(next);
  }

  function clearOverride(item: LayoutItem) {
    clearTimeout(settleTimers.get(item));
    settleTimers.delete(item);
    if (overrideMap[item]) setOverride(item, null);
  }

  function applySettings(next: OverlaySettings) {
    setSettings(next);
    for (const item of LAYOUT_ITEMS) {
      const override = overrideMap[item];
      if (override && drag?.item !== item && sameLayoutBox(override, next.layout[item])) clearOverride(item);
    }
  }

  function postLayout(item: LayoutItem, box: LayoutBox, done: boolean) {
    window.parent.postMessage(toPreviewMessageData({ type: "layout", item, box, done }), window.location.origin);
  }

  function startDrag(item: LayoutItem, mode: DragMode, element: HTMLElement, event: PointerEvent) {
    if (!props.preview || !editing() || drag || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    element.setPointerCapture(event.pointerId);
    clearOverride(item);
    drag = {
      item,
      mode,
      element,
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      start: settings().layout[item],
      box: null,
      frame: 0,
    };
    setDragging({ item, mode });
  }

  function moveDrag(event: PointerEvent) {
    const state = drag;
    if (!state || event.pointerId !== state.pointerId) return;
    const { width, height } = canvas();
    if (!(width > 0 && height > 0)) return;
    const delta = { x: (event.clientX - state.origin.x) / width, y: (event.clientY - state.origin.y) / height };
    const box = state.mode === "move" ? moveLayoutBox(state.start, delta) : resizeLayoutBox(state.start, state.mode, delta);
    state.box = box;
    setOverride(state.item, box);
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      if (drag === state && state.box) postLayout(state.item, state.box, false);
    });
  }

  function endDrag(event: PointerEvent | null, cancelled: boolean) {
    const state = drag;
    if (!state || (event && event.pointerId !== state.pointerId)) return;
    drag = null;
    setDragging(null);
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    if (state.element.hasPointerCapture(state.pointerId)) state.element.releasePointerCapture(state.pointerId);
    if (cancelled) {
      clearOverride(state.item);
      return;
    }
    postLayout(state.item, state.box ?? state.start, true);
    if (state.box) {
      const item = state.item;
      settleTimers.set(item, setTimeout(() => clearOverride(item), SETTLE_TIMEOUT_MS));
    }
  }

  onSettled(() => {
    const onResize = () => setCanvas({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      stopTracking();
      if (drag) cancelAnimationFrame(drag.frame);
      drag = null;
      for (const timer of settleTimers.values()) clearTimeout(timer);
      settleTimers.clear();
    };
  });

  onSettled(() => {
    const sessionId = props.sessionId;
    if (!sessionId) return;

    const receive = (event: ObsOverlayEvent) => {
      if (event.sessionId !== sessionId) return;
      if (event.type === "ready") return;
      if (event.type === "settings") {
        applySettings(parseSettings(event.settings));
        return;
      }
      if (event.type === "card") {
        setCard(event.card);
        setConfidence(event.confidence);
        if (!event.card) {
          setCardId(null);
          setCorners(null);
          stopTracking();
        }
      } else {
        setCardId(event.cardId);
        setCorners(event.corners);
        setTracking(true);
        clearTimeout(trackingTimer);
        trackingTimer = setTimeout(() => {
          trackingTimer = undefined;
          setTracking(false);
        }, TRACKING_TIMEOUT_MS);
      }
    };

    if (props.preview) {
      // The scanner app feeds its embedded preview directly, so the preview works without OBS.
      const onMessage = (message: MessageEvent) => {
        if (message.origin !== window.location.origin || message.source !== window.parent) return;
        const previewMessage = parsePreviewMessage(message.data);
        if (previewMessage) {
          if (previewMessage.type === "edit") {
            if (!previewMessage.editing) endDrag(null, false);
            setEditing(previewMessage.editing);
          }
          return;
        }
        const event = parseObsOverlayEvent(message.data);
        if (event) receive(event);
      };
      window.addEventListener("message", onMessage);
      window.parent.postMessage(toOverlayEventData({ type: "ready", sessionId }), window.location.origin);
      return () => window.removeEventListener("message", onMessage);
    }

    const client = new ObsWebSocketClient({ port, password: password() }, (status) => {
      setConnected(status.state === "connected");
      setConnectionMessage(status.state === "error" ? status.message : "Connecting to OBS…");
      if (status.state === "connected") client.broadcast({ type: "ready", sessionId });
    }, receive);
    connection = client;
    client.start();

    return () => {
      client.stop();
      connection = undefined;
    };
  });

  const displayCard = createMemo(() => card() ?? (editing() ? SAMPLE_CARD : null));
  const withImage = createMemo(() => settings().showImage);
  const { shown, visible } = useShownCard(displayCard, withImage);
  const box = (item: LayoutItem) => overrides()[item] ?? settings().layout[item];
  const dragMode = (item: LayoutItem) => (dragging()?.item === item ? dragging()!.mode : null);
  const followEnabled = createMemo(() => settings().follow && settings().followSides.length > 0);
  const trackedCorners = createMemo(() => (cardId() !== null && cardId() === card()?.id ? corners() : null));
  const followCorners = createMemo(() => (editing() ? SAMPLE_CORNERS : trackedCorners()));
  const followVisible = createMemo(() => {
    const current = shown();
    if (!visible() || !current) return false;
    if (editing()) return true;
    return tracking() && trackedCorners() !== null && current.id === card()?.id;
  });
  const debugOutline = createMemo(() => {
    const points = settings().debug ? corners() : null;
    return points ? points.map(([x, y]) => `${x * 100},${y * 100}`).join(" ") : null;
  });
  const pinnedProps = {
    onDragStart: startDrag,
    onDragMove: moveDrag,
    onDragEnd: endDrag,
  };

  return (
    <>
      <Show when={debugOutline()}>
        {(points) => (
          <svg class="debug-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={points()} />
          </svg>
        )}
      </Show>
      <Show when={settings().showImage}>
        <Pinned
          item="image"
          box={box("image")}
          canvas={canvas()}
          aspect={CARD_ASPECT}
          fontSize={settings().textSize}
          visible={visible()}
          editing={editing()}
          dragging={dragMode("image")}
          {...pinnedProps}
        >
          <Show when={shown()}>{(current) => <CardImage card={current()} placeholder={editing()} />}</Show>
        </Pinned>
      </Show>
      <Show when={settings().showName}>
        <Pinned
          item="name"
          box={box("name")}
          canvas={canvas()}
          fontSize={settings().textSize}
          visible={visible()}
          editing={editing()}
          dragging={dragMode("name")}
          {...pinnedProps}
        >
          <Show when={shown()}>{(current) => <CardName card={current()} size={settings().nameTextSize} />}</Show>
        </Pinned>
      </Show>
      <Show when={settings().showDetails && settings().details.length > 0}>
        <Pinned
          item="details"
          box={box("details")}
          canvas={canvas()}
          fontSize={settings().detailsTextSize ?? settings().textSize}
          visible={visible()}
          editing={editing()}
          dragging={dragMode("details")}
          {...pinnedProps}
        >
          <Show when={shown()}>
            {(current) => (
              <CardDetails
                card={current()}
                fields={settings().details}
                currency={settings().currency}
                allFinishes={settings().allFinishes}
                confidence={confidence()}
                sizes={settings().detailTextSizes}
              />
            )}
          </Show>
        </Pinned>
      </Show>
      <Show when={followEnabled()}>
        <Show when={editing()}>
          <div class="ghost-card" aria-hidden="true">Tracked card</div>
        </Show>
        <FollowPanel
          card={shown()}
          confidence={confidence()}
          settings={settings()}
          corners={followCorners()}
          canvas={canvas()}
          visible={followVisible()}
          placeholder={editing()}
        />
      </Show>
      <Show when={!props.sessionId}>
        <p class="notice">This overlay URL has no session. Copy the OBS URL from the scanner app.</p>
      </Show>
      <Show when={props.sessionId && !props.preview && !connected()}>
        <form class="connection-prompt" onSubmit={submitPassword}>
          <strong>Connect to OBS</strong>
          <span>{connectionMessage()}</span>
          <label>
            OBS WebSocket password
            <input
              type="password"
              autocomplete="current-password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
            />
          </label>
          <button type="submit">Connect</button>
          <small>Password is stored in this OBS browser profile. Copying the URL from the scanner again also includes it.</small>
        </form>
      </Show>
    </>
  );
}

function passwordStorageKey(port: number): string {
  return `mtg-scanner:obs-password:${port}`;
}

function loadObsPassword(port: number): string {
  try {
    return localStorage.getItem(passwordStorageKey(port)) ?? "";
  } catch {
    return "";
  }
}
