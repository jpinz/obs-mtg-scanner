import { describe, expect, it } from "vitest";
import { placeFollowPanel } from "./followPlacement";

const canvas = { width: 1000, height: 1000 };
const panel = { width: 200, height: 100 };
const options = { gap: 10, margin: 20 };

function box(minX: number, minY: number, maxX: number, maxY: number): [number, number][] {
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
}

describe("placeFollowPanel", () => {
  it("picks the allowed side with the most free space, centered beside the card", () => {
    const card = box(0.375, 0.25, 0.625, 0.5);
    expect(placeFollowPanel(card, panel, canvas, ["top", "bottom", "left", "right"], options))
      .toEqual({ side: "bottom", left: 400, top: 510 });
    expect(placeFollowPanel(card, panel, canvas, ["top", "left"], options))
      .toEqual({ side: "left", left: 165, top: 325 });
  });

  it("falls back to the roomiest allowed side when none fits, clamping to the margin", () => {
    const card = box(0.0625, 0.0625, 0.9375, 0.875);
    expect(placeFollowPanel(card, panel, canvas, ["top", "bottom"], options))
      .toEqual({ side: "bottom", left: 400, top: 880 });
  });

  it("clamps the panel inside the canvas near an edge", () => {
    expect(placeFollowPanel(box(0, 0.375, 0.125, 0.625), panel, canvas, ["top"], options))
      .toEqual({ side: "top", left: 20, top: 265 });
  });

  it("returns null without allowed sides or corners", () => {
    expect(placeFollowPanel(box(0.4, 0.4, 0.6, 0.6), panel, canvas, [], options)).toBeNull();
    expect(placeFollowPanel([], panel, canvas, ["top"], options)).toBeNull();
  });
});
