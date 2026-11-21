import { clampLayoutBox, LAYOUT_ITEMS, type LayoutBox, type LayoutItem } from "./settings";

/** Marks postMessage traffic between the scanner app and its preview iframe for layout editing. */
export const PREVIEW_MESSAGE_SOURCE = "mtg-scanner-preview";

export type PreviewMessage =
  /** App → preview: enter or leave layout edit mode. */
  | { type: "edit"; editing: boolean }
  /** Preview → app: a component was moved or resized; `done` is true on pointerup. */
  | { type: "layout"; item: LayoutItem; box: LayoutBox; done: boolean };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLayoutItem(value: unknown): value is LayoutItem {
  return typeof value === "string" && (LAYOUT_ITEMS as readonly string[]).includes(value);
}

export function toPreviewMessageData(message: PreviewMessage): Record<string, unknown> {
  return { source: PREVIEW_MESSAGE_SOURCE, ...message };
}

export function parsePreviewMessage(data: unknown): PreviewMessage | null {
  if (!isObject(data) || data.source !== PREVIEW_MESSAGE_SOURCE) return null;

  if (data.type === "edit") {
    return typeof data.editing === "boolean" ? { type: "edit", editing: data.editing } : null;
  }

  if (data.type === "layout") {
    const box = data.box;
    if (!isLayoutItem(data.item) || typeof data.done !== "boolean" || !isObject(box)) return null;
    if (![box.x, box.y, box.width, box.height].every(isFiniteNumber)) return null;
    return {
      type: "layout",
      item: data.item,
      box: clampLayoutBox({ x: box.x as number, y: box.y as number, width: box.width as number, height: box.height as number }),
      done: data.done,
    };
  }

  return null;
}
