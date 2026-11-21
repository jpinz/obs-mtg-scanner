import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type OverlaySettings } from "./settings";

describe("parseSettings", () => {
  it("returns defaults for an empty query", () => {
    expect(parseSettings("")).toEqual(DEFAULT_SETTINGS);
  });

  it("parses every supported parameter", () => {
    const s = parseSettings(
      "?currency=eur_foil&pos=top-left&image=0&set=false&duration=0&threshold=0.7&catalog=v1&camera=abc&res=1920x1080&mirror=1&theme=light&accent=22c55e&scale=1.5&debug=on",
    );
    expect(s).toEqual<OverlaySettings>({
      currency: "eur_foil",
      position: "top-left",
      showImage: false,
      showSet: false,
      duration: 0,
      threshold: 0.7,
      catalog: "v1",
      camera: "abc",
      resolution: { width: 1920, height: 1080 },
      mirror: true,
      theme: "light",
      accent: "#22c55e",
      scale: 1.5,
      debug: true,
    });
  });

  it("falls back or clamps on invalid values", () => {
    const s = parseSettings("?currency=gbp&pos=middle&image=maybe&threshold=5&scale=abc&res=big&accent=red&duration=-3");
    expect(s.currency).toBe(DEFAULT_SETTINGS.currency);
    expect(s.position).toBe(DEFAULT_SETTINGS.position);
    expect(s.showImage).toBe(DEFAULT_SETTINGS.showImage);
    expect(s.threshold).toBe(1);
    expect(s.scale).toBe(DEFAULT_SETTINGS.scale);
    expect(s.resolution).toEqual(DEFAULT_SETTINGS.resolution);
    expect(s.accent).toBe(DEFAULT_SETTINGS.accent);
    expect(s.duration).toBe(0);
  });
});

describe("serializeSettings", () => {
  it("omits defaults and round-trips changed values", () => {
    expect(serializeSettings({ ...DEFAULT_SETTINGS }).toString()).toBe("");
    const changed: OverlaySettings = {
      ...DEFAULT_SETTINGS,
      currency: "tix",
      mirror: true,
      resolution: { width: 1920, height: 1080 },
      camera: "device id/with+chars",
    };
    const query = serializeSettings(changed);
    expect(query.has("theme")).toBe(false);
    expect(parseSettings(query.toString())).toEqual(changed);
  });
});
