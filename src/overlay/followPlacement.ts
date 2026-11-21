import { FOLLOW_SIDES, type FollowSide } from "../settings";

export interface Size {
  width: number;
  height: number;
}

/** Top-left corner of the panel within the canvas, in px. */
export interface FollowPlacement {
  side: FollowSide;
  left: number;
  top: number;
}

const DEFAULT_GAP = 16;
const DEFAULT_MARGIN = 24;

function clampAxis(start: number, size: number, extent: number, margin: number): number {
  const max = extent - margin - size;
  if (max < margin) return margin;
  return Math.min(max, Math.max(margin, start));
}

/**
 * Places the follow panel beside the card on the allowed side with the most free space, preferring sides it fits on.
 * `corners` are the card corners normalized to 0–1; `gap` is the px between the card and the panel and `margin`
 * the px kept from the canvas edges. Returns null when there are no sides or corners.
 */
export function placeFollowPanel(
  corners: readonly (readonly [number, number])[],
  panel: Size,
  canvas: Size,
  sides: readonly FollowSide[],
  { gap = DEFAULT_GAP, margin = DEFAULT_MARGIN }: { gap?: number; margin?: number } = {},
): FollowPlacement | null {
  const allowed = FOLLOW_SIDES.filter((side) => sides.includes(side));
  if (allowed.length === 0 || corners.length === 0) return null;

  const xs = corners.map(([x]) => x * canvas.width);
  const ys = corners.map(([, y]) => y * canvas.height);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const space: Record<FollowSide, number> = {
    top: minY,
    bottom: canvas.height - maxY,
    left: minX,
    right: canvas.width - maxX,
  };
  const fits = (side: FollowSide) =>
    space[side] >= (side === "top" || side === "bottom" ? panel.height : panel.width) + gap + margin;
  // Strict comparison keeps the earlier side in FOLLOW_SIDES order on ties.
  const roomiest = (candidates: readonly FollowSide[]) =>
    candidates.reduce<FollowSide | null>((best, side) => (best === null || space[side] > space[best] ? side : best), null);
  const side = roomiest(allowed.filter(fits)) ?? roomiest(allowed);
  if (side === null) return null;

  const centerX = (minX + maxX) / 2 - panel.width / 2;
  const centerY = (minY + maxY) / 2 - panel.height / 2;
  const [left, top]: [number, number] =
    side === "top" ? [centerX, minY - gap - panel.height]
    : side === "bottom" ? [centerX, maxY + gap]
    : side === "left" ? [minX - gap - panel.width, centerY]
    : [maxX + gap, centerY];

  return {
    side,
    left: clampAxis(left, panel.width, canvas.width, margin),
    top: clampAxis(top, panel.height, canvas.height, margin),
  };
}
