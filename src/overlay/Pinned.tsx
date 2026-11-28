import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import type { LayoutBox, LayoutItem } from "../settings";
import { RESIZE_HANDLES, type ResizeHandle } from "./dragPosition";
import type { Size } from "./followPlacement";

const LABELS: Record<LayoutItem, string> = {
  image: "Picture",
  name: "Name",
  details: "Details",
  total: "Total value",
  highest: "Highest value card",
};

export const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/** What the pointer is doing to a component: moving it, or resizing it from a handle. */
export type DragMode = "move" | ResizeHandle;

/**
 * A component pinned to a canvas box; movable and resizable while the layout is being edited in the preview.
 * With `aspect` (width / height) the content is fitted inside the box keeping that ratio.
 */
export function Pinned(props: {
  item: LayoutItem;
  box: LayoutBox;
  canvas: Size;
  aspect?: number;
  fontSize: number;
  backgroundOpacity?: number;
  visible: boolean;
  editing: boolean;
  dragging: DragMode | null;
  onDragStart: (item: LayoutItem, mode: DragMode, element: HTMLElement, event: PointerEvent) => void;
  onDragMove: (event: PointerEvent) => void;
  onDragEnd: (event: PointerEvent, cancelled: boolean) => void;
  children: JSX.Element;
}) {
  const fitted = () => {
    const aspect = props.aspect;
    if (!aspect) return undefined;
    const width = Math.min(props.box.width * props.canvas.width, props.box.height * props.canvas.height * aspect);
    return { width: `${width}px`, height: `${width / aspect}px` };
  };

  const startDrag = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-handle]")?.dataset.handle as ResizeHandle | undefined;
    props.onDragStart(props.item, handle ?? "move", event.currentTarget, event);
  };

  return (
    <section
      class={[
        "pinned",
        `pinned--${props.item}`,
        {
          "pinned--visible": props.visible,
          "pinned--editing": props.editing,
          "pinned--dragging": props.dragging !== null,
        },
      ]}
      style={{
        left: `${props.box.x * 100}%`,
        top: `${props.box.y * 100}%`,
        width: `${props.box.width * 100}%`,
        height: `${props.box.height * 100}%`,
        "font-size": `${props.fontSize}px`,
        cursor: props.dragging && props.dragging !== "move" ? HANDLE_CURSORS[props.dragging] : undefined,
      }}
      aria-live={props.item === "image" ? undefined : "polite"}
      onPointerDown={startDrag}
      onPointerMove={(event) => props.onDragMove(event)}
      onPointerUp={(event) => props.onDragEnd(event, false)}
      onPointerCancel={(event) => props.onDragEnd(event, true)}
    >
      <div
        class={["pinned__content", { surface: props.item !== "image" }]}
        style={{ ...fitted(), "--panel-opacity": props.backgroundOpacity }}
      >
        {props.children}
      </div>
      <Show when={props.editing}>
        <span class="pinned__label" aria-hidden="true">{LABELS[props.item]}</span>
        <For each={RESIZE_HANDLES}>
          {(handle) => (
            <span
              class={["pinned__handle", `pinned__handle--${handle}`]}
              data-handle={handle}
              style={{ cursor: HANDLE_CURSORS[handle] }}
              aria-hidden="true"
            />
          )}
        </For>
      </Show>
    </section>
  );
}
