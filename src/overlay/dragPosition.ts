import { MIN_LAYOUT_SIZE, type LayoutBox } from "../settings";

export interface Point {
  x: number;
  y: number;
}

export const RESIZE_HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Moves a box by `delta` (canvas fractions), keeping its size and the whole box inside the canvas. */
export function moveLayoutBox(start: LayoutBox, delta: Point): LayoutBox {
  return {
    ...start,
    x: clamp(start.x + delta.x, 0, Math.max(0, 1 - start.width)),
    y: clamp(start.y + delta.y, 0, Math.max(0, 1 - start.height)),
  };
}

/** Moves one or both edges an axis range by `delta`; the opposite edge stays fixed. */
function resizeAxis(start: number, size: number, delta: number, edge: "start" | "end" | null, minSize: number) {
  const end = start + size;
  if (edge === "start") {
    const next = clamp(start + delta, 0, Math.max(0, end - minSize));
    return { start: next, size: end - next };
  }
  if (edge === "end") {
    const next = clamp(end + delta, Math.min(1, start + minSize), 1);
    return { start, size: next - start };
  }
  return { start, size };
}

/**
 * Resizes a box by dragging `handle` by `delta` (canvas fractions). Edges change one dimension, corners both;
 * the opposite edges stay fixed, each dimension keeps at least `minSize`, and the box stays inside the canvas.
 */
export function resizeLayoutBox(start: LayoutBox, handle: ResizeHandle, delta: Point, minSize = MIN_LAYOUT_SIZE): LayoutBox {
  const horizontal = handle.includes("w") ? "start" : handle.includes("e") ? "end" : null;
  const vertical = handle.includes("n") ? "start" : handle.includes("s") ? "end" : null;
  const x = resizeAxis(start.x, start.width, delta.x, horizontal, minSize);
  const y = resizeAxis(start.y, start.height, delta.y, vertical, minSize);
  return { x: x.start, y: y.start, width: x.size, height: y.size };
}

export function sameLayoutBox(a: LayoutBox, b: LayoutBox, tolerance = 0.001): boolean {
  return Math.abs(a.x - b.x) <= tolerance
    && Math.abs(a.y - b.y) <= tolerance
    && Math.abs(a.width - b.width) <= tolerance
    && Math.abs(a.height - b.height) <= tolerance;
}
