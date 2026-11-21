import { describe, expect, it } from "vitest";
import { moveLayoutBox, resizeLayoutBox, sameLayoutBox } from "./dragPosition";

const box = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 };

function expectBox(actual: typeof box, expected: typeof box) {
  for (const key of ["x", "y", "width", "height"] as const) expect(actual[key]).toBeCloseTo(expected[key]);
}

describe("moveLayoutBox", () => {
  it("moves by the delta and keeps the size", () => {
    expectBox(moveLayoutBox(box, { x: 0.1, y: -0.2 }), { x: 0.5, y: 0.2, width: 0.2, height: 0.2 });
  });

  it("keeps the whole box inside the canvas", () => {
    expectBox(moveLayoutBox(box, { x: -1, y: 1 }), { x: 0, y: 0.8, width: 0.2, height: 0.2 });
  });
});

describe("resizeLayoutBox", () => {
  it("moves only the dragged edge", () => {
    expectBox(resizeLayoutBox(box, "e", { x: 0.1, y: 0.3 }), { x: 0.4, y: 0.4, width: 0.3, height: 0.2 });
    expectBox(resizeLayoutBox(box, "n", { x: 0.3, y: -0.1 }), { x: 0.4, y: 0.3, width: 0.2, height: 0.3 });
  });

  it("moves both edges of a corner", () => {
    expectBox(resizeLayoutBox(box, "nw", { x: -0.1, y: 0.05 }), { x: 0.3, y: 0.45, width: 0.3, height: 0.15 });
    expectBox(resizeLayoutBox(box, "se", { x: 0.1, y: 0.1 }), { x: 0.4, y: 0.4, width: 0.3, height: 0.3 });
  });

  it("keeps the minimum size without moving the opposite edge", () => {
    expectBox(resizeLayoutBox(box, "w", { x: 0.5, y: 0 }, 0.05), { x: 0.55, y: 0.4, width: 0.05, height: 0.2 });
    expectBox(resizeLayoutBox(box, "s", { x: 0, y: -0.5 }, 0.05), { x: 0.4, y: 0.4, width: 0.2, height: 0.05 });
  });

  it("stops at the canvas bounds", () => {
    expectBox(resizeLayoutBox(box, "ne", { x: 1, y: -1 }), { x: 0.4, y: 0, width: 0.6, height: 0.6 });
    expectBox(resizeLayoutBox(box, "sw", { x: -1, y: 1 }), { x: 0, y: 0.4, width: 0.6, height: 0.6 });
  });
});

describe("sameLayoutBox", () => {
  it("compares every value within the tolerance", () => {
    expect(sameLayoutBox(box, { x: 0.4009, y: 0.3991, width: 0.2, height: 0.2005 })).toBe(true);
    expect(sameLayoutBox(box, { ...box, width: 0.202 })).toBe(false);
  });
});
