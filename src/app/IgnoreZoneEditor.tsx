import { createSignal, For, onSettled } from "solid-js";
import { Portal } from "@solidjs/web";
import { moveLayoutBox, resizeLayoutBox, RESIZE_HANDLES, type Point, type ResizeHandle } from "../overlay/dragPosition";
import type { IgnoreZone } from "../settings";

/** Smallest width or height a zone can be dragged or resized to, as a fraction of the video. */
const MIN_ZONE_SIZE = 0.02;
const NEW_ZONE_SIZE = 0.2;

type DragMode = "create" | "move" | ResizeHandle;

interface Drag {
  pointerId: number;
  mode: DragMode;
  index: number;
  origin: Point;
  start: IgnoreZone;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function IgnoreZoneEditor(props: {
  frame: HTMLDivElement;
  mirror: boolean;
  zones: readonly IgnoreZone[];
  onChange(zones: readonly IgnoreZone[]): void;
  onDone(): void;
}) {
  const [bounds, setBounds] = createSignal({ left: 0, top: 0, width: 0, height: 0 });
  const [selected, setSelected] = createSignal<number | null>(null);
  // Live box (display space) for the zone being dragged; committed on pointer up.
  const [preview, setPreview] = createSignal<{ index: number; box: IgnoreZone } | null>(null);
  let drag: Drag | null = null;
  let surface!: HTMLDivElement;

  onSettled(() => {
    const update = () => {
      const video = props.frame.querySelector("video");
      const width = props.frame.clientWidth;
      const height = props.frame.clientHeight;
      if (!video?.videoWidth || !video.videoHeight || !width || !height) {
        setBounds({ left: 0, top: 0, width: 0, height: 0 });
        return;
      }
      const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      setBounds({ left: (width - w) / 2, top: (height - h) / 2, width: w, height: h });
    };
    const observer = new ResizeObserver(update);
    observer.observe(props.frame);
    props.frame.addEventListener("loadedmetadata", update, true);
    props.frame.addEventListener("resize", update, true);
    update();
    return () => {
      observer.disconnect();
      props.frame.removeEventListener("loadedmetadata", update, true);
      props.frame.removeEventListener("resize", update, true);
    };
  });

  // Mirroring is a horizontal flip, so the same conversion maps stored zones to display space and back.
  const flip = (zone: IgnoreZone): IgnoreZone => props.mirror ? { ...zone, x: 1 - zone.x - zone.width } : zone;
  const displayZone = (index: number): IgnoreZone => {
    const live = preview();
    return live?.index === index ? live.box : flip(props.zones[index]!);
  };
  const commit = (index: number, box: IgnoreZone) => {
    const zones = [...props.zones];
    zones[index] = flip(box);
    props.onChange(zones);
  };
  const remove = (index: number) => {
    props.onChange(props.zones.filter((_, i) => i !== index));
    setSelected(null);
  };
  const addZone = () => {
    const offset = Math.min(props.zones.length, 5) * 0.04;
    const start = (1 - NEW_ZONE_SIZE) / 2 + offset - 0.1;
    props.onChange([...props.zones, { x: start, y: start, width: NEW_ZONE_SIZE, height: NEW_ZONE_SIZE }]);
    setSelected(props.zones.length);
    requestAnimationFrame(() => surface.querySelector<HTMLElement>(`[data-zone="${props.zones.length - 1}"]`)?.focus());
  };
  const pointer = (event: PointerEvent): Point => {
    const rect = surface.getBoundingClientRect();
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) };
  };

  const startDrag = (event: PointerEvent) => {
    if (event.button !== 0 || drag) return;
    const target = event.target as HTMLElement;
    const zoneEl = target.closest<HTMLElement>("[data-zone]");
    const origin = pointer(event);
    if (zoneEl) {
      const index = Number(zoneEl.dataset.zone);
      const handle = target.closest<HTMLElement>("[data-handle]")?.dataset.handle as ResizeHandle | undefined;
      drag = { pointerId: event.pointerId, mode: handle ?? "move", index, origin, start: displayZone(index) };
      setSelected(index);
    } else {
      drag = { pointerId: event.pointerId, mode: "create", index: props.zones.length, origin, start: { ...origin, width: 0, height: 0 } };
      setSelected(null);
    }
    surface.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = pointer(event);
    const delta = { x: point.x - drag.origin.x, y: point.y - drag.origin.y };
    let box: IgnoreZone;
    if (drag.mode === "create") {
      box = {
        x: Math.min(drag.origin.x, point.x),
        y: Math.min(drag.origin.y, point.y),
        width: Math.abs(delta.x),
        height: Math.abs(delta.y),
      };
    } else if (drag.mode === "move") {
      box = moveLayoutBox(drag.start, delta);
    } else {
      box = resizeLayoutBox(drag.start, drag.mode, delta, MIN_ZONE_SIZE);
    }
    setPreview({ index: drag.index, box });
  };
  const endDrag = (event: PointerEvent, cancelled: boolean) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { mode, index } = drag;
    const box = preview()?.box;
    drag = null;
    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    setPreview(null);
    if (cancelled || !box) return;
    if (mode === "create") {
      // A click or tiny drag on empty video just clears the selection.
      if (box.width < MIN_ZONE_SIZE || box.height < MIN_ZONE_SIZE) return;
      props.onChange([...props.zones, flip(box)]);
      setSelected(index);
    } else {
      commit(index, box);
    }
  };

  const onZoneKey = (index: number, event: KeyboardEvent) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      remove(index);
      surface.focus();
      event.preventDefault();
      return;
    }
    const step = event.shiftKey ? 0.05 : 0.01;
    const arrows: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = arrows[event.key];
    if (!delta) return;
    const start = displayZone(index);
    commit(index, event.altKey ? resizeLayoutBox(start, "se", delta, MIN_ZONE_SIZE) : moveLayoutBox(start, delta));
    event.preventDefault();
  };

  const percent = (value: number) => `${value * 100}%`;
  const creating = () => {
    const live = preview();
    return live && live.index === props.zones.length ? live.box : null;
  };

  return (
    <>
      <Portal mount={props.frame}><div
        ref={surface}
        class="ignore-zones"
        style={{ left: `${bounds().left}px`, top: `${bounds().top}px`, width: `${bounds().width}px`, height: `${bounds().height}px` }}
        tabindex="-1"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={(event) => endDrag(event, false)}
        onPointerCancel={(event) => endDrag(event, true)}
        onLostPointerCapture={(event) => endDrag(event, true)}
      >
        <For each={props.zones} keyed={false}>{(_zone, index) => {
          const box = () => displayZone(index);
          return (
            <div
              class={["ignore-zones__zone", { "ignore-zones__zone--selected": selected() === index }]}
              data-zone={index}
              style={{ left: percent(box().x), top: percent(box().y), width: percent(box().width), height: percent(box().height) }}
              tabindex="0"
              role="group"
              aria-label={`Ignore zone ${index + 1}. Arrow keys move it, Alt plus arrow keys resize it, Shift moves in larger steps, Delete removes it.`}
              onFocus={() => setSelected(index)}
              onKeyDown={(event) => onZoneKey(index, event)}
            >
              <span class="ignore-zones__label" aria-hidden="true">{index + 1}</span>
              <For each={RESIZE_HANDLES}>{(handle) => (
                <span class={["ignore-zones__handle", `ignore-zones__handle--${handle}`]} data-handle={handle} aria-hidden="true" />
              )}</For>
            </div>
          );
        }}</For>
        {creating() && (
          <div class="ignore-zones__draft" style={{
            left: percent(creating()!.x), top: percent(creating()!.y), width: percent(creating()!.width), height: percent(creating()!.height),
          }} />
        )}
      </div></Portal>
      <div class="ignore-controls">
        <p>Drag on the video to draw a zone. Drag a zone to move it, or drag its handles to resize it.</p>
        <div class="preview__actions">
          <button type="button" class="button button--secondary" onClick={addZone}>Add zone</button>
          <button type="button" class="button button--secondary" onClick={props.onDone}>Done</button>
        </div>
        <For each={props.zones}>{(_zone, index) => (
          <button type="button" class="button button--secondary" onClick={() => remove(index())}>
            Remove zone {index() + 1}
          </button>
        )}</For>
      </div>
    </>
  );
}