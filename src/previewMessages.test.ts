import { describe, expect, it } from "vitest";
import { parsePreviewMessage, PREVIEW_MESSAGE_SOURCE, toPreviewMessageData, type PreviewMessage } from "./previewMessages";

describe("preview messages", () => {
  it("round-trips messages and clamps boxes into the canvas", () => {
    const messages: PreviewMessage[] = [
      { type: "edit", editing: true },
      { type: "layout", item: "details", box: { x: 0.25, y: 0.5, width: 0.2, height: 0.1 }, done: false },
    ];
    for (const message of messages) {
      expect(parsePreviewMessage(toPreviewMessageData(message))).toEqual(message);
    }
    const box = { x: -1, y: 2, width: 0.5, height: 0 };
    expect(parsePreviewMessage({ source: PREVIEW_MESSAGE_SOURCE, type: "layout", item: "name", box, done: true }))
      .toEqual({ type: "layout", item: "name", box: { x: 0, y: 0.98, width: 0.5, height: 0.02 }, done: true });
  });

  it("rejects other sources, unknown items, and non-finite boxes", () => {
    const layout = {
      source: PREVIEW_MESSAGE_SOURCE,
      type: "layout",
      item: "image",
      box: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
      done: true,
    };
    expect(parsePreviewMessage({ ...layout, source: "obs-mtg-scanner" })).toBeNull();
    expect(parsePreviewMessage({ ...layout, item: "price" })).toBeNull();
    expect(parsePreviewMessage({ ...layout, box: { ...layout.box, x: Number.NaN } })).toBeNull();
    expect(parsePreviewMessage({ ...layout, box: { x: 0.5, y: 0.5, width: 0.1 } })).toBeNull();
  });
});
